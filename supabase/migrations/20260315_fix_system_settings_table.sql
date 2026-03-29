-- ============================================
-- Fix system_settings Table Schema
-- ============================================
-- This migration fixes the system_settings table structure
-- Run this BEFORE 20260315_userdata_add_missing_columns.sql

-- Drop the existing table with wrong schema
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- Recreate with correct schema
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('bot_enabled', 'true', 'Enable/disable LINE bot'),
  ('require_registration', 'true', 'Require user registration'),
  ('allow_stock_query', 'true', 'Allow users to query stock'),
  ('line_channel_token', '', 'LINE Channel Access Token'),
  ('line_channel_secret', '', 'LINE Channel Secret'),
  ('line_bot_basic_id', '', 'LINE Bot Basic ID'),
  ('rich_menu_id', '', 'LINE Rich Menu ID')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key
ON public.system_settings USING btree (key);

-- Add comment
COMMENT ON TABLE public.system_settings IS 'System-wide configuration settings for Boonyang Inventory';
