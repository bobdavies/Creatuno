-- ============================================
-- PITCH STAGE TABLES
-- ============================================
-- The Pitch Stage: A public marketplace where creatives and mentors
-- publish investment pitches for investors to discover.

-- Pitch status enum
CREATE TYPE pitch_status AS ENUM ('draft', 'live', 'funded', 'closed');

-- ============================================
-- PITCHES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS pitches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  creative_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT NOT NULL,
  category TEXT,
  funding_ask NUMERIC,
  currency TEXT DEFAULT 'USD',
  cover_image TEXT,
  video_url TEXT,
  skills TEXT[] DEFAULT '{}',
  status pitch_status DEFAULT 'draft',
  interest_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient browsing
CREATE INDEX idx_pitches_status ON pitches(status);
CREATE INDEX idx_pitches_sender ON pitches(sender_id);
CREATE INDEX idx_pitches_creative ON pitches(creative_id);
CREATE INDEX idx_pitches_category ON pitches(category);
CREATE INDEX idx_pitches_created ON pitches(created_at DESC);

-- ============================================
-- PITCH INTERESTS TABLE
-- ============================================
-- Investors express interest in pitches (like raising a paddle)

CREATE TABLE IF NOT EXISTS pitch_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pitch_id UUID NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  investor_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pitch_id, investor_id)
);

CREATE INDEX idx_pitch_interests_pitch ON pitch_interests(pitch_id);
CREATE INDEX idx_pitch_interests_investor ON pitch_interests(investor_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_interests ENABLE ROW LEVEL SECURITY;

-- Pitches: anyone can read live pitches, owners can manage their own
CREATE POLICY "Anyone can view live pitches"
  ON pitches FOR SELECT
  USING (status = 'live');

CREATE POLICY "Users can view own pitches"
  ON pitches FOR SELECT
  USING (sender_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create pitches"
  ON pitches FOR INSERT
  WITH CHECK (sender_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own pitches"
  ON pitches FOR UPDATE
  USING (sender_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete own pitches"
  ON pitches FOR DELETE
  USING (sender_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Pitch interests: investors can manage their own, pitch owners can view
CREATE POLICY "Pitch owners can view interests"
  ON pitch_interests FOR SELECT
  USING (
    investor_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR pitch_id IN (
      SELECT id FROM pitches WHERE sender_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Investors can express interest"
  ON pitch_interests FOR INSERT
  WITH CHECK (investor_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Investors can withdraw interest"
  ON pitch_interests FOR DELETE
  USING (investor_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_pitches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pitches_updated_at
  BEFORE UPDATE ON pitches
  FOR EACH ROW EXECUTE FUNCTION update_pitches_updated_at();
