-- ============================================
-- CREATUNO FEATURE ENHANCEMENTS MIGRATION
-- ============================================
-- Migration 003: Adds bookmarks, messages, and mentorship_feedback tables
-- Run this SQL in your Supabase SQL Editor after migrations 001 and 002
-- ============================================

-- ============================================
-- 1. BOOKMARKS TABLE (Investor portfolio bookmarking)
-- ============================================

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can bookmark a portfolio only once
  UNIQUE(user_id, portfolio_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_portfolio_id ON bookmarks(portfolio_id);

-- RLS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can insert their own bookmarks
CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');


-- ============================================
-- 2. MESSAGES TABLE (Simple messaging between users)
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(receiver_id, is_read);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (
    sender_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR receiver_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Users can send messages (insert where they are the sender)
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Users can mark messages as read (only receiver)
CREATE POLICY "Receivers can update messages"
  ON messages FOR UPDATE
  USING (receiver_id = current_setting('request.jwt.claims', true)::json->>'sub');


-- ============================================
-- 3. MENTORSHIP FEEDBACK TABLE (Reviews/ratings for mentors)
-- ============================================

CREATE TABLE IF NOT EXISTS mentorship_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentorship_request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each reviewer can only leave one review per mentorship
  UNIQUE(mentorship_request_id, reviewer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mentorship_feedback_mentor_id ON mentorship_feedback(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_feedback_reviewer_id ON mentorship_feedback(reviewer_id);

-- RLS
ALTER TABLE mentorship_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can view feedback (public reviews)
CREATE POLICY "Anyone can view mentorship feedback"
  ON mentorship_feedback FOR SELECT
  USING (true);

-- Users can insert feedback where they are the reviewer
CREATE POLICY "Users can insert own feedback"
  ON mentorship_feedback FOR INSERT
  WITH CHECK (reviewer_id = current_setting('request.jwt.claims', true)::json->>'sub');


-- ============================================
-- 4. ADD notification_preferences TO profiles (if not exists)
-- ============================================

-- This is safe to run even if the column already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{}';
  END IF;
END $$;


-- ============================================
-- 5. TRIGGER for messages updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_messages_updated_at ON messages;
CREATE TRIGGER trigger_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messages_updated_at();


-- ============================================
-- 6. WORK SUBMISSIONS TABLE (Creative delivers work to Employer)
-- ============================================

CREATE TABLE IF NOT EXISTS work_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  creative_id TEXT NOT NULL,
  employer_id TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  files JSONB NOT NULL DEFAULT '[]',   -- array of {url, name, size, type}
  status TEXT NOT NULL DEFAULT 'submitted',  -- submitted, revision_requested, approved
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_work_submissions_application_id ON work_submissions(application_id);
CREATE INDEX IF NOT EXISTS idx_work_submissions_opportunity_id ON work_submissions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_work_submissions_creative_id ON work_submissions(creative_id);
CREATE INDEX IF NOT EXISTS idx_work_submissions_employer_id ON work_submissions(employer_id);

-- RLS
ALTER TABLE work_submissions ENABLE ROW LEVEL SECURITY;

-- Creatives and employers involved can view submissions
CREATE POLICY "Users can view own work submissions"
  ON work_submissions FOR SELECT
  USING (
    creative_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR employer_id = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Creatives can submit work
CREATE POLICY "Creatives can insert work submissions"
  ON work_submissions FOR INSERT
  WITH CHECK (creative_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Employers can update work submissions (approve / request revision)
CREATE POLICY "Employers can update work submissions"
  ON work_submissions FOR UPDATE
  USING (employer_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_work_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_work_submissions_updated_at ON work_submissions;
CREATE TRIGGER trigger_work_submissions_updated_at
  BEFORE UPDATE ON work_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_work_submissions_updated_at();
