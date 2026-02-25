-- ============================================================
-- Migration 012: Backfill wallet receivables safely
-- ============================================================
-- Credits wallet for historical receivables that were collected
-- but never paid out externally, using strict idempotency keys.
-- ============================================================

CREATE OR REPLACE FUNCTION wallet_backfill_receivables(
  p_user_id TEXT,
  p_currency TEXT DEFAULT 'SLE'
)
RETURNS TABLE(applied_count INTEGER, applied_amount DECIMAL)
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_count INTEGER := 0;
  v_amount DECIMAL(12, 2) := 0;
  v_entry_id UUID;
  v_currency TEXT := UPPER(COALESCE(p_currency, 'SLE'));
  v_key TEXT;
BEGIN
  -- Delivery receivables: payment collected, no provider payout initiated.
  FOR v_record IN
    SELECT
      id,
      status,
      net_payout_amount,
      currency
    FROM delivery_escrows
    WHERE creative_id = p_user_id
      AND status IN ('payment_received', 'partial_payment_received')
      AND monime_payout_id IS NULL
      AND UPPER(COALESCE(currency, 'SLE')) = v_currency
  LOOP
    v_key := 'backfill:delivery_escrow:' || v_record.id::text;
    IF EXISTS (SELECT 1 FROM wallet_ledger WHERE idempotency_key = v_key) THEN
      CONTINUE;
    END IF;

    v_entry_id := wallet_apply_mutation(
      p_user_id,
      v_currency,
      v_record.net_payout_amount,
      0,
      'credit',
      v_record.net_payout_amount,
      'delivery_escrow',
      v_record.id,
      v_key,
      jsonb_build_object(
        'source', 'wallet_backfill_receivables',
        'table', 'delivery_escrows',
        'record_id', v_record.id::text
      )
    );

    IF v_entry_id IS NOT NULL THEN
      IF v_record.status = 'partial_payment_received' THEN
        UPDATE delivery_escrows
        SET status = 'partial_payout_completed'
        WHERE id = v_record.id
          AND status = 'partial_payment_received';
      ELSE
        UPDATE delivery_escrows
        SET status = 'completed'
        WHERE id = v_record.id
          AND status = 'payment_received';
      END IF;

      v_count := v_count + 1;
      v_amount := v_amount + COALESCE(v_record.net_payout_amount, 0);
    END IF;
  END LOOP;

  -- Pitch receivables: payment collected, no provider payout initiated.
  FOR v_record IN
    SELECT
      id,
      net_payout_amount,
      currency
    FROM pitch_investments
    WHERE recipient_id = p_user_id
      AND status = 'payment_received'
      AND COALESCE(payout_status, 'pending') IN ('pending', 'failed')
      AND monime_payout_id IS NULL
      AND UPPER(COALESCE(currency, 'SLE')) = v_currency
  LOOP
    v_key := 'backfill:pitch_investment:' || v_record.id::text;
    IF EXISTS (SELECT 1 FROM wallet_ledger WHERE idempotency_key = v_key) THEN
      CONTINUE;
    END IF;

    v_entry_id := wallet_apply_mutation(
      p_user_id,
      v_currency,
      v_record.net_payout_amount,
      0,
      'credit',
      v_record.net_payout_amount,
      'pitch_investment',
      v_record.id,
      v_key,
      jsonb_build_object(
        'source', 'wallet_backfill_receivables',
        'table', 'pitch_investments',
        'record_id', v_record.id::text
      )
    );

    IF v_entry_id IS NOT NULL THEN
      UPDATE pitch_investments
      SET
        status = 'completed',
        payout_status = 'completed'
      WHERE id = v_record.id
        AND status = 'payment_received';

      v_count := v_count + 1;
      v_amount := v_amount + COALESCE(v_record.net_payout_amount, 0);
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_count, v_amount;
END;
$$;

SELECT 'Wallet receivable backfill function ready' AS status;
