-- ============================================
-- CREATUNO: ADD ATTACHMENTS TO MESSAGES
-- ============================================
-- Migration 004: Adds attachments JSONB column to messages table
-- Run this SQL in your Supabase SQL Editor after migration 003
-- ============================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- attachments format: [{ "name": "file.pdf", "url": "https://...", "size": 12345, "type": "application/pdf" }]
