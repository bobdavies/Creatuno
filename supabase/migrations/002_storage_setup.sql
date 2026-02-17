-- ============================================
-- CREATUNO STORAGE BUCKETS
-- ============================================
-- Run this AFTER the initial schema migration
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor
-- ============================================

-- Create storage buckets

-- 1. Portfolio Images Bucket (for project images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'portfolio-images',
    'portfolio-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Avatars Bucket (for profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Post Images Bucket (for Village Square posts)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'post-images',
    'post-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Opportunity Attachments Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'opportunity-attachments',
    'opportunity-attachments',
    false, -- Private - only accessible to relevant users
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Portfolio Images Policies
-- Anyone can view (public bucket)
CREATE POLICY "Portfolio images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio-images');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload portfolio images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio-images');

-- Users can update their own images
CREATE POLICY "Users can update their portfolio images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio-images');

-- Users can delete their own images
CREATE POLICY "Users can delete their portfolio images"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio-images');

-- Avatars Policies
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update their avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');

-- Post Images Policies
CREATE POLICY "Post images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "Users can update their post images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'post-images');

CREATE POLICY "Users can delete their post images"
ON storage.objects FOR DELETE
USING (bucket_id = 'post-images');

-- Opportunity Attachments Policies (private bucket)
CREATE POLICY "Authenticated users can view opportunity attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'opportunity-attachments');

CREATE POLICY "Authenticated users can upload opportunity attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'opportunity-attachments');

CREATE POLICY "Users can update their opportunity attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'opportunity-attachments');

CREATE POLICY "Users can delete their opportunity attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'opportunity-attachments');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Storage buckets and policies created successfully!' AS status;
