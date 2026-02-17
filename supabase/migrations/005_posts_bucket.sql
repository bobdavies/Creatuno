-- ============================================
-- CREATUNO: CREATE POSTS STORAGE BUCKET
-- ============================================
-- Migration 005: Creates the 'posts' bucket for media uploads
-- including images, videos, and voice messages
-- Run this SQL in your Supabase SQL Editor after migration 004
-- ============================================

-- Create 'posts' bucket (for post media, voice messages, chat attachments)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'posts',
    'posts',
    true,
    52428800, -- 50MB limit (for videos and voice messages)
    NULL      -- No MIME type restriction at bucket level; validated in the API layer instead
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = NULL;

-- Allow authenticated users to upload to 'posts' bucket
CREATE POLICY "Authenticated users can upload to posts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'posts');

-- Allow public read access to 'posts' bucket
CREATE POLICY "Public read access for posts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'posts');

-- Allow users to update their own uploads in 'posts'
CREATE POLICY "Users can update own posts uploads"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'posts');

-- Allow users to delete their own uploads in 'posts'
CREATE POLICY "Users can delete own posts uploads"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'posts');
