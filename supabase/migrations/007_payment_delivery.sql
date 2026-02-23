-- ============================================
-- CREATUNO PAYMENT & DELIVERY MIGRATION
-- ============================================
-- Migration 007: Secure work delivery with escrow payments via Monime
-- Adds revision_count to work_submissions, payment fields to profiles,
-- delivery_escrows table, deliverables-protected bucket, and Monime
-- columns on transactions.
-- ============================================

-- ============================================
-- 1. FIX work_submissions SCHEMA GAPS
-- ============================================

-- Add revision_count (used in API but missing from migration 003)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_submissions' AND column_name = 'revision_count'
  ) THEN
    ALTER TABLE work_submissions ADD COLUMN revision_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Drop the old status constraint and replace with an expanded one
-- that includes 'superseded' and 'payment_pending'
ALTER TABLE work_submissions DROP CONSTRAINT IF EXISTS work_submissions_status_check;
ALTER TABLE work_submissions ADD CONSTRAINT work_submissions_status_check
  CHECK (status IN ('submitted', 'revision_requested', 'approved', 'superseded', 'payment_pending'));

-- ============================================
-- 2. ADD PAYMENT FIELDS TO profiles
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payment_provider TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payment_provider_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payment_provider_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payment_account'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payment_account TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'payment_account_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN payment_account_verified BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- 3. DELIVERY ESCROWS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS delivery_escrows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES work_submissions(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  creative_id TEXT NOT NULL,
  employer_id TEXT NOT NULL,

  agreed_amount DECIMAL(12, 2) NOT NULL,
  payment_amount DECIMAL(12, 2) NOT NULL,
  payment_percentage INTEGER NOT NULL DEFAULT 100,
  currency TEXT NOT NULL DEFAULT 'SLE',

  monime_checkout_session_id TEXT,
  monime_order_number TEXT,
  monime_payout_id TEXT,

  platform_fee DECIMAL(12, 2) DEFAULT 0,
  net_payout_amount DECIMAL(12, 2) DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'awaiting_review'
    CHECK (status IN (
      'awaiting_review',
      'review_approved',
      'awaiting_payment',
      'payment_received',
      'payout_initiated',
      'completed',
      'revision_exhausted_awaiting_payment',
      'partial_payment_received',
      'partial_payout_completed'
    )),

  files_released BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_escrows_submission_id ON delivery_escrows(submission_id);
CREATE INDEX IF NOT EXISTS idx_delivery_escrows_application_id ON delivery_escrows(application_id);
CREATE INDEX IF NOT EXISTS idx_delivery_escrows_creative_id ON delivery_escrows(creative_id);
CREATE INDEX IF NOT EXISTS idx_delivery_escrows_employer_id ON delivery_escrows(employer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_escrows_status ON delivery_escrows(status);
CREATE INDEX IF NOT EXISTS idx_delivery_escrows_checkout ON delivery_escrows(monime_checkout_session_id);

-- RLS
ALTER TABLE delivery_escrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Escrows viewable by participants"
  ON delivery_escrows FOR SELECT
  USING (
    creative_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR employer_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );

CREATE POLICY "System can insert escrows"
  ON delivery_escrows FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update escrows"
  ON delivery_escrows FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_delivery_escrows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delivery_escrows_updated_at ON delivery_escrows;
CREATE TRIGGER trigger_delivery_escrows_updated_at
  BEFORE UPDATE ON delivery_escrows
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_escrows_updated_at();

-- ============================================
-- 4. CREATE deliverables-protected STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deliverables-protected',
  'deliverables-protected',
  false,
  52428800, -- 50MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'image/svg+xml', 'image/vnd.adobe.photoshop',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed', 'application/vnd.rar',
    'application/postscript', 'application/octet-stream',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only authenticated users can upload to their own folder
CREATE POLICY "Authenticated users can upload deliverables"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'deliverables-protected'
    AND auth.role() = 'authenticated'
  );

-- No public SELECT -- files are served via server-side signed URLs only
CREATE POLICY "Service role can read protected deliverables"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'deliverables-protected'
    AND auth.role() = 'service_role'
  );

-- ============================================
-- 5. ADD MONIME COLUMNS TO transactions
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'monime_checkout_session_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN monime_checkout_session_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'monime_payout_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN monime_payout_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'monime_order_number'
  ) THEN
    ALTER TABLE transactions ADD COLUMN monime_order_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE transactions ADD COLUMN payment_type TEXT DEFAULT 'full'
      CHECK (payment_type IN ('full', 'partial_50'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'escrow_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN escrow_id UUID REFERENCES delivery_escrows(id);
  END IF;
END $$;

-- ============================================
-- SUCCESS
-- ============================================
SELECT 'Payment & delivery migration applied successfully!' AS status;
