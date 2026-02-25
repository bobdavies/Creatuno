-- ============================================================
-- Migration 010: Payment reliability and security hardening
-- ============================================================

-- 1) Webhook dedupe ledger (provider event idempotency)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'monime',
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  object_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhook_events_provider_event
  ON payment_webhook_events(provider, event_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_name
  ON payment_webhook_events(event_name);

-- 2) Idempotency uniqueness for transaction side effects
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_escrow_payment_type
  ON transactions(escrow_id, payment_type)
  WHERE escrow_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_pitch_investment
  ON transactions(pitch_investment_id)
  WHERE pitch_investment_id IS NOT NULL;

-- 3) Idempotency uniqueness for provider references
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_escrows_checkout
  ON delivery_escrows(monime_checkout_session_id)
  WHERE monime_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_escrows_order
  ON delivery_escrows(monime_order_number)
  WHERE monime_order_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_escrows_payout
  ON delivery_escrows(monime_payout_id)
  WHERE monime_payout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pitch_investments_checkout
  ON pitch_investments(monime_checkout_session_id)
  WHERE monime_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pitch_investments_order
  ON pitch_investments(monime_order_number)
  WHERE monime_order_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pitch_investments_payout
  ON pitch_investments(monime_payout_id)
  WHERE monime_payout_id IS NOT NULL;

-- 4) Monetary integrity checks
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_amounts_nonnegative;
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_amounts_nonnegative
  CHECK (amount > 0 AND platform_fee >= 0 AND net_amount >= 0) NOT VALID;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_net_amount_equation;
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_net_amount_equation
  CHECK (net_amount = amount - platform_fee) NOT VALID;

ALTER TABLE delivery_escrows
  DROP CONSTRAINT IF EXISTS chk_delivery_escrows_amounts_nonnegative;
ALTER TABLE delivery_escrows
  ADD CONSTRAINT chk_delivery_escrows_amounts_nonnegative
  CHECK (
    agreed_amount > 0
    AND payment_amount > 0
    AND platform_fee >= 0
    AND net_payout_amount >= 0
  ) NOT VALID;

ALTER TABLE delivery_escrows
  DROP CONSTRAINT IF EXISTS chk_delivery_escrows_net_amount_equation;
ALTER TABLE delivery_escrows
  ADD CONSTRAINT chk_delivery_escrows_net_amount_equation
  CHECK (net_payout_amount = payment_amount - platform_fee) NOT VALID;

ALTER TABLE delivery_escrows
  DROP CONSTRAINT IF EXISTS chk_delivery_escrows_payment_percentage;
ALTER TABLE delivery_escrows
  ADD CONSTRAINT chk_delivery_escrows_payment_percentage
  CHECK (payment_percentage IN (50, 100)) NOT VALID;

ALTER TABLE pitch_investments
  DROP CONSTRAINT IF EXISTS chk_pitch_investments_amounts_nonnegative;
ALTER TABLE pitch_investments
  ADD CONSTRAINT chk_pitch_investments_amounts_nonnegative
  CHECK (amount > 0 AND platform_fee >= 0 AND net_payout_amount >= 0) NOT VALID;

ALTER TABLE pitch_investments
  DROP CONSTRAINT IF EXISTS chk_pitch_investments_net_amount_equation;
ALTER TABLE pitch_investments
  ADD CONSTRAINT chk_pitch_investments_net_amount_equation
  CHECK (net_payout_amount = amount - platform_fee) NOT VALID;

-- 5) Cross-field consistency for transactions by payment_type
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_relationship_consistency;
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_relationship_consistency
  CHECK (
    (
      payment_type IN ('full', 'partial_50')
      AND escrow_id IS NOT NULL
      AND pitch_investment_id IS NULL
      AND opportunity_id IS NOT NULL
      AND application_id IS NOT NULL
    )
    OR
    (
      payment_type = 'pitch_investment'
      AND pitch_investment_id IS NOT NULL
      AND escrow_id IS NULL
      AND opportunity_id IS NULL
      AND application_id IS NULL
    )
  ) NOT VALID;

-- 6) Atomic funding increment helper
CREATE OR REPLACE FUNCTION increment_pitch_total_funded(p_pitch_id UUID, p_amount DECIMAL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE pitches
  SET total_funded = COALESCE(total_funded, 0) + p_amount
  WHERE id = p_pitch_id;
END;
$$;

SELECT 'Payment hardening migration applied' AS status;

