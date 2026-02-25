-- ============================================================
-- Migration 011: Hybrid wallet cashout support
-- ============================================================
-- Adds wallet balance storage, immutable wallet ledger, cashout
-- requests, payout mode preference, and atomic mutation function.
-- ============================================================

-- ============================================
-- 1) PROFILES PAYOUT MODE
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payout_mode'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payout_mode TEXT NOT NULL DEFAULT 'auto';
  END IF;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_payout_mode_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_payout_mode_check
  CHECK (payout_mode IN ('auto', 'wallet'));

-- ============================================
-- 2) USER WALLETS
-- ============================================
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'SLE',
  available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, currency),
  CONSTRAINT chk_user_wallets_nonnegative
    CHECK (available_balance >= 0 AND pending_balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);

-- ============================================
-- 3) WALLET LEDGER
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'SLE',
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('credit', 'debit', 'hold', 'release', 'adjustment')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  available_delta DECIMAL(12, 2) NOT NULL DEFAULT 0,
  pending_delta DECIMAL(12, 2) NOT NULL DEFAULT 0,
  balance_after_available DECIMAL(12, 2) NOT NULL,
  balance_after_pending DECIMAL(12, 2) NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('delivery_escrow', 'pitch_investment', 'cashout_request', 'system_adjustment')),
  source_id UUID,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_id ON wallet_ledger(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created_at ON wallet_ledger(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_ledger_idempotency_key
  ON wallet_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================
-- 4) CASHOUT REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS cashout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'SLE',
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  provider TEXT NOT NULL CHECK (provider IN ('momo', 'bank', 'wallet')),
  provider_id TEXT NOT NULL,
  account_masked TEXT NOT NULL,
  monime_payout_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'initiated', 'completed', 'failed')),
  failure_reason TEXT,
  initiated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_id ON cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_wallet_id ON cashout_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_status ON cashout_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashout_requests_monime_payout_id
  ON cashout_requests(monime_payout_id)
  WHERE monime_payout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashout_requests_idempotency_key
  ON cashout_requests(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================
-- 5) updated_at TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS trigger_user_wallets_updated_at ON user_wallets;
CREATE TRIGGER trigger_user_wallets_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_cashout_requests_updated_at ON cashout_requests;
CREATE TRIGGER trigger_cashout_requests_updated_at
  BEFORE UPDATE ON cashout_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6) RLS + POLICIES
-- ============================================
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wallets viewable by owner" ON user_wallets;
CREATE POLICY "Wallets viewable by owner"
  ON user_wallets FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "System can insert wallets" ON user_wallets;
CREATE POLICY "System can insert wallets"
  ON user_wallets FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update wallets" ON user_wallets;
CREATE POLICY "System can update wallets"
  ON user_wallets FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Ledger viewable by owner" ON wallet_ledger;
CREATE POLICY "Ledger viewable by owner"
  ON wallet_ledger FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "System can insert wallet ledger" ON wallet_ledger;
CREATE POLICY "System can insert wallet ledger"
  ON wallet_ledger FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Cashouts viewable by owner" ON cashout_requests;
CREATE POLICY "Cashouts viewable by owner"
  ON cashout_requests FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

DROP POLICY IF EXISTS "System can insert cashouts" ON cashout_requests;
CREATE POLICY "System can insert cashouts"
  ON cashout_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update cashouts" ON cashout_requests;
CREATE POLICY "System can update cashouts"
  ON cashout_requests FOR UPDATE
  USING (true);

-- ============================================
-- 7) ATOMIC WALLET MUTATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION wallet_apply_mutation(
  p_user_id TEXT,
  p_currency TEXT,
  p_available_delta DECIMAL,
  p_pending_delta DECIMAL,
  p_entry_type TEXT,
  p_amount DECIMAL,
  p_source_type TEXT,
  p_source_id UUID,
  p_idempotency_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet user_wallets%ROWTYPE;
  v_existing_ledger_id UUID;
  v_new_available DECIMAL(12, 2);
  v_new_pending DECIMAL(12, 2);
  v_ledger_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet mutation amount must be > 0';
  END IF;

  IF p_currency IS NULL OR length(trim(p_currency)) = 0 THEN
    RAISE EXCEPTION 'wallet currency is required';
  END IF;

  IF p_entry_type NOT IN ('credit', 'debit', 'hold', 'release', 'adjustment') THEN
    RAISE EXCEPTION 'invalid wallet entry type: %', p_entry_type;
  END IF;

  IF p_source_type NOT IN ('delivery_escrow', 'pitch_investment', 'cashout_request', 'system_adjustment') THEN
    RAISE EXCEPTION 'invalid wallet source type: %', p_source_type;
  END IF;

  -- idempotent replay returns existing ledger entry id without mutating balances.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_ledger_id
    FROM wallet_ledger
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_ledger_id IS NOT NULL THEN
      RETURN v_existing_ledger_id;
    END IF;
  END IF;

  INSERT INTO user_wallets (user_id, currency)
  VALUES (p_user_id, p_currency)
  ON CONFLICT (user_id, currency) DO NOTHING;

  SELECT *
  INTO v_wallet
  FROM user_wallets
  WHERE user_id = p_user_id AND currency = p_currency
  FOR UPDATE;

  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'wallet not found for user % and currency %', p_user_id, p_currency;
  END IF;

  v_new_available := COALESCE(v_wallet.available_balance, 0) + COALESCE(p_available_delta, 0);
  v_new_pending := COALESCE(v_wallet.pending_balance, 0) + COALESCE(p_pending_delta, 0);

  IF v_new_available < 0 OR v_new_pending < 0 THEN
    RAISE EXCEPTION 'wallet mutation would produce negative balance (available %, pending %)', v_new_available, v_new_pending;
  END IF;

  UPDATE user_wallets
  SET
    available_balance = v_new_available,
    pending_balance = v_new_pending
  WHERE id = v_wallet.id;

  INSERT INTO wallet_ledger (
    wallet_id,
    user_id,
    currency,
    entry_type,
    amount,
    available_delta,
    pending_delta,
    balance_after_available,
    balance_after_pending,
    source_type,
    source_id,
    idempotency_key,
    metadata
  ) VALUES (
    v_wallet.id,
    p_user_id,
    p_currency,
    p_entry_type,
    p_amount,
    COALESCE(p_available_delta, 0),
    COALESCE(p_pending_delta, 0),
    v_new_available,
    v_new_pending,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_ledger_id;

  RETURN v_ledger_id;
END;
$$;

SELECT 'Wallet cashout migration applied successfully!' AS status;
