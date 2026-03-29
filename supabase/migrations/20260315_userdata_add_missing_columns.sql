-- ============================================
-- Add Missing Columns to userdata Table
-- For Boonyang Inventory Registration Flow
-- ============================================

-- NOTE: Using status_register for flow status tracking instead of separate flow_status column
-- status_register will store: 'pending', 'รอชื่อ', 'รอนามสกุล', 'รอชื่อร้าน', 'รอเลขที่ภาษี', 'สำเร็จ'

-- Add status column for user status
ALTER TABLE public.userdata
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add check constraint for status
ALTER TABLE public.userdata
DROP CONSTRAINT IF EXISTS userdata_status_check;

ALTER TABLE public.userdata
ADD CONSTRAINT userdata_status_check
CHECK (status IN ('pending', 'active', 'suspended'));

-- Add index for status column
CREATE INDEX IF NOT EXISTS idx_userdata_status
ON public.userdata USING btree (status);

-- ============================================
-- Create cache_metadata Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.cache_metadata (
  key TEXT PRIMARY KEY,
  data_type TEXT NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl_seconds INTEGER DEFAULT 1800,
  item_count INTEGER DEFAULT 0
);

-- Add indexes for cache_metadata
CREATE INDEX IF NOT EXISTS idx_cache_metadata_data_type
ON public.cache_metadata USING btree (data_type);

CREATE INDEX IF NOT EXISTS idx_cache_metadata_last_updated
ON public.cache_metadata USING btree (last_updated);

-- ============================================
-- Add GIN Index for InventData Fuzzy Search
-- ============================================

-- Enable pg_trgm extension if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index for fuzzy search on item_name
DROP INDEX IF EXISTS public.idx_inventdata_item_name_gin;
CREATE INDEX idx_inventdata_item_name_gin
ON public.inventdata USING gin(item_name gin_trgm_ops);

-- ============================================
-- Update System Settings
-- ============================================

-- Insert additional settings if not exists
INSERT INTO public.system_settings (key, value, description) VALUES
  ('line_channel_token', '', 'LINE Channel Access Token'),
  ('line_channel_secret', '', 'LINE Channel Secret'),
  ('line_bot_basic_id', '', 'LINE Bot Basic ID'),
  ('rich_menu_id', '', 'LINE Rich Menu ID')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Add Comments for Documentation
-- ============================================

COMMENT ON COLUMN public.userdata.status_register IS 'Registration flow status: pending, รอชื่อ, รอนามสกุล, รอชื่อร้าน, รอเลขที่ภาษี, สำเร็จ';
COMMENT ON COLUMN public.userdata.status IS 'User status: pending, active, suspended';
COMMENT ON TABLE public.cache_metadata IS 'Cache management for BotData and InventData';
