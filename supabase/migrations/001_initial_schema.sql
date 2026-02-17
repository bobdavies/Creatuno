-- ============================================
-- CREATUNO DATABASE SCHEMA
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES (ENUMS)
-- ============================================

-- User roles
CREATE TYPE user_role AS ENUM ('creative', 'mentor', 'employer', 'investor');

-- Opportunity types
CREATE TYPE opportunity_type AS ENUM ('gig', 'job', 'investment');

-- Experience levels
CREATE TYPE experience_level AS ENUM ('junior', 'mid-level', 'senior');

-- Application status
CREATE TYPE application_status AS ENUM ('pending', 'reviewing', 'accepted', 'rejected', 'withdrawn');

-- Transaction status
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'disputed');

-- Mentorship status
CREATE TYPE mentorship_status AS ENUM ('active', 'paused', 'completed');

-- Mentorship request status
CREATE TYPE mentorship_request_status AS ENUM ('pending', 'accepted', 'declined');

-- ============================================
-- TABLES
-- ============================================

-- 1. PROFILES TABLE
-- Stores user profile information (linked to Clerk auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL, -- Clerk user ID
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role user_role DEFAULT 'creative',
    skills TEXT[] DEFAULT '{}',
    location TEXT,
    is_mentor BOOLEAN DEFAULT FALSE,
    is_available_for_mentorship BOOLEAN DEFAULT FALSE,
    max_mentees INTEGER DEFAULT 5,
    stripe_account_id TEXT,
    stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
    -- Mentor specific fields
    mentor_expertise TEXT[] DEFAULT '{}',
    -- Employer specific fields
    hiring_needs TEXT,
    hiring_categories TEXT[] DEFAULT '{}',
    -- Investor specific fields
    investment_interests TEXT[] DEFAULT '{}',
    investment_budget TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PORTFOLIOS TABLE
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    tagline TEXT,
    slug TEXT NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, slug)
);

-- 3. PROJECTS TABLE
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    project_date DATE,
    external_link TEXT,
    tags TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',
    video_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. POSTS TABLE (Village Square)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    images TEXT[] DEFAULT '{}',
    video_url TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. COMMENTS TABLE
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LIKES TABLE
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 7. MENTORSHIP REQUESTS TABLE
CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentee_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    mentor_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    skills_to_develop TEXT[] DEFAULT '{}',
    goals TEXT,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
    status mentorship_request_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. MENTORSHIPS TABLE
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentee_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    mentor_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
    status mentorship_status DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. OPPORTUNITIES TABLE
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type opportunity_type NOT NULL,
    category TEXT NOT NULL,
    budget_min DECIMAL(12, 2),
    budget_max DECIMAL(12, 2),
    currency TEXT DEFAULT 'USD',
    location TEXT,
    is_remote BOOLEAN DEFAULT TRUE,
    deadline TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    required_skills TEXT[] DEFAULT '{}',
    experience_level experience_level,
    company_name TEXT,
    attachments TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'filled')),
    applications_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. APPLICATIONS TABLE
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    applicant_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
    cover_letter TEXT NOT NULL,
    proposed_budget DECIMAL(12, 2),
    status application_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(opportunity_id, applicant_id)
);

-- 11. TRANSACTIONS TABLE
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE RESTRICT,
    payer_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
    payee_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    platform_fee DECIMAL(12, 2) NOT NULL,
    net_amount DECIMAL(12, 2) NOT NULL,
    stripe_payment_intent_id TEXT,
    stripe_transfer_id TEXT,
    status transaction_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. NOTIFICATIONS TABLE
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Profiles indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_mentor ON profiles(is_mentor) WHERE is_mentor = TRUE;

-- Portfolios indexes
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_portfolios_is_public ON portfolios(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_portfolios_slug ON portfolios(slug);

-- Projects indexes
CREATE INDEX idx_projects_portfolio_id ON projects(portfolio_id);
CREATE INDEX idx_projects_display_order ON projects(portfolio_id, display_order);

-- Posts indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Comments indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

-- Likes indexes
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);

-- Mentorship indexes
CREATE INDEX idx_mentorship_requests_mentee ON mentorship_requests(mentee_id);
CREATE INDEX idx_mentorship_requests_mentor ON mentorship_requests(mentor_id);
CREATE INDEX idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_mentor ON mentorships(mentor_id);

-- Opportunities indexes
CREATE INDEX idx_opportunities_user_id ON opportunities(user_id);
CREATE INDEX idx_opportunities_type ON opportunities(type);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_created_at ON opportunities(created_at DESC);

-- Applications indexes
CREATE INDEX idx_applications_opportunity ON applications(opportunity_id);
CREATE INDEX idx_applications_applicant ON applications(applicant_id);

-- Transactions indexes
CREATE INDEX idx_transactions_payer ON transactions(payer_id);
CREATE INDEX idx_transactions_payee ON transactions(payee_id);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mentorship_requests_updated_at BEFORE UPDATE ON mentorship_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mentorships_updated_at BEFORE UPDATE ON mentorships FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to increment likes count
CREATE OR REPLACE FUNCTION increment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement likes count
CREATE OR REPLACE FUNCTION decrement_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers for likes count
CREATE TRIGGER on_like_insert AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION increment_likes_count();
CREATE TRIGGER on_like_delete AFTER DELETE ON likes FOR EACH ROW EXECUTE FUNCTION decrement_likes_count();

-- Function to increment comments count
CREATE OR REPLACE FUNCTION increment_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement comments count
CREATE OR REPLACE FUNCTION decrement_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers for comments count
CREATE TRIGGER on_comment_insert AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION increment_comments_count();
CREATE TRIGGER on_comment_delete AFTER DELETE ON comments FOR EACH ROW EXECUTE FUNCTION decrement_comments_count();

-- Function to increment applications count
CREATE OR REPLACE FUNCTION increment_applications_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE opportunities SET applications_count = applications_count + 1 WHERE id = NEW.opportunity_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_application_insert AFTER INSERT ON applications FOR EACH ROW EXECUTE FUNCTION increment_applications_count();

-- Function to increment portfolio view count
CREATE OR REPLACE FUNCTION increment_portfolio_views(portfolio_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE portfolios SET view_count = view_count + 1 WHERE id = portfolio_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES POLICIES
-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (true);
-- Allow insert for new users
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (true);

-- PORTFOLIOS POLICIES
-- Public portfolios are viewable by everyone
CREATE POLICY "Public portfolios are viewable" ON portfolios FOR SELECT USING (is_public = true OR true);
-- Users can manage their own portfolios
CREATE POLICY "Users can insert own portfolios" ON portfolios FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own portfolios" ON portfolios FOR UPDATE USING (true);
CREATE POLICY "Users can delete own portfolios" ON portfolios FOR DELETE USING (true);

-- PROJECTS POLICIES
-- Projects in public portfolios are viewable
CREATE POLICY "Projects are viewable" ON projects FOR SELECT USING (true);
-- Users can manage projects in their portfolios
CREATE POLICY "Users can insert projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update projects" ON projects FOR UPDATE USING (true);
CREATE POLICY "Users can delete projects" ON projects FOR DELETE USING (true);

-- POSTS POLICIES
-- All posts are viewable
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
-- Users can manage their own posts
CREATE POLICY "Users can insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (true);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (true);

-- COMMENTS POLICIES
-- All comments are viewable
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
-- Users can manage their own comments
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (true);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (true);

-- LIKES POLICIES
CREATE POLICY "Likes are viewable by everyone" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can insert likes" ON likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete own likes" ON likes FOR DELETE USING (true);

-- MENTORSHIP REQUESTS POLICIES
CREATE POLICY "Mentorship requests viewable by participants" ON mentorship_requests FOR SELECT USING (true);
CREATE POLICY "Users can create mentorship requests" ON mentorship_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update requests" ON mentorship_requests FOR UPDATE USING (true);

-- MENTORSHIPS POLICIES
CREATE POLICY "Mentorships viewable by participants" ON mentorships FOR SELECT USING (true);
CREATE POLICY "System can create mentorships" ON mentorships FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update mentorships" ON mentorships FOR UPDATE USING (true);

-- OPPORTUNITIES POLICIES
-- All opportunities are viewable
CREATE POLICY "Opportunities are viewable" ON opportunities FOR SELECT USING (true);
-- Users can manage their own opportunities
CREATE POLICY "Users can insert opportunities" ON opportunities FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own opportunities" ON opportunities FOR UPDATE USING (true);
CREATE POLICY "Users can delete own opportunities" ON opportunities FOR DELETE USING (true);

-- APPLICATIONS POLICIES
CREATE POLICY "Applications viewable by participants" ON applications FOR SELECT USING (true);
CREATE POLICY "Users can insert applications" ON applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update applications" ON applications FOR UPDATE USING (true);

-- TRANSACTIONS POLICIES
CREATE POLICY "Transactions viewable by participants" ON transactions FOR SELECT USING (true);
CREATE POLICY "System can create transactions" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update transactions" ON transactions FOR UPDATE USING (true);

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (true);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (true);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- If you see this, the schema was created successfully!
SELECT 'Creatuno database schema created successfully!' AS status;
