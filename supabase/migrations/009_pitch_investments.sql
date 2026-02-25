-- ============================================================
-- Migration 009: Pitch Investment Funding
-- ============================================================
-- Adds pitch_investments table for investor -> creative/mentor funding,
-- total_funded column on pitches, and updates transactions to support
-- pitch investment payment types.
-- ============================================================

-- ============================================
-- 1. PITCH INVESTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS pitch_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  investor_id TEXT NOT NULL REFERENCES profiles(user_id),
  recipient_id TEXT NOT NULL REFERENCES profiles(user_id),

  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SLE',
  platform_fee DECIMAL(12, 2) DEFAULT 0,
  net_payout_amount DECIMAL(12, 2) DEFAULT 0,

  monime_checkout_session_id TEXT,
  monime_order_number TEXT,
  monime_payout_id TEXT,

  status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN (
      'awaiting_payment',
      'payment_received',
      'payout_initiated',
      'completed',
      'failed'
    )),

  payout_status TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'initiated', 'completed', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pitch_investments_pitch_id ON pitch_investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_pitch_investments_investor_id ON pitch_investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_pitch_investments_recipient_id ON pitch_investments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_pitch_investments_status ON pitch_investments(status);
CREATE INDEX IF NOT EXISTS idx_pitch_investments_checkout ON pitch_investments(monime_checkout_session_id);

-- RLS
ALTER TABLE pitch_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investments viewable by participants"
  ON pitch_investments FOR SELECT
  USING (
    investor_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR recipient_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );

CREATE POLICY "System can insert investments"
  ON pitch_investments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update investments"
  ON pitch_investments FOR UPDATE
  USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_pitch_investments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pitch_investments_updated_at ON pitch_investments;
CREATE TRIGGER trigger_pitch_investments_updated_at
  BEFORE UPDATE ON pitch_investments
  FOR EACH ROW
  EXECUTE FUNCTION update_pitch_investments_updated_at();

-- ============================================
-- 2. ADD total_funded TO pitches
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pitches' AND column_name = 'total_funded'
  ) THEN
    ALTER TABLE pitches ADD COLUMN total_funded DECIMAL(12, 2) DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- 3. EXPAND transactions.payment_type FOR PITCH INVESTMENTS
-- ============================================

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_payment_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_payment_type_check
  CHECK (payment_type IN ('full', 'partial_50', 'pitch_investment'));

-- Allow nullable opportunity_id and application_id for pitch investments
-- (pitch investments don't have an opportunity or application)
DO $$
BEGIN
  ALTER TABLE transactions ALTER COLUMN opportunity_id DROP NOT NULL;
  ALTER TABLE transactions ALTER COLUMN application_id DROP NOT NULL;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Add pitch_investment_id column to transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'pitch_investment_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN pitch_investment_id UUID REFERENCES pitch_investments(id);
  END IF;
END $$;

-- ============================================
-- SUCCESS
-- ============================================
SELECT 'Pitch investments migration applied successfully!' AS status;
