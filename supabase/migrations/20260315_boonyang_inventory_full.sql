-- ============================================
-- Boonyang Inventory System - Full Schema
-- LINE Bot Database Schema with BotData & InventData
-- ============================================

-- ============================================
-- LINE Users Table (Extended with registration fields)
-- ============================================
CREATE TABLE IF NOT EXISTS line_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL, -- LINE User ID
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,

  -- Registration fields
  name TEXT,
  surname TEXT,
  shop_name TEXT,
  tax_id TEXT,

  -- User role/permissions
  userstaff TEXT DEFAULT '' CHECK (userstaff IN ('', 'admin', 'customer')),
  status_register TEXT DEFAULT 'pending' CHECK (status_register IN ('pending', 'สำเร็จ')),
  flow_status TEXT, -- For multi-step registration: 'รอชื่อ', 'รอนามสกุล', 'รอชื่อร้าน', 'รอเลขที่ภาษี'

  -- Registration tracking
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  registration_time TEXT, -- HH:mm format
  language TEXT,

  -- Group info
  group_name TEXT,
  group_id TEXT,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
);

CREATE INDEX idx_line_users_user_id ON line_users(user_id);
CREATE INDEX idx_line_users_status ON line_users(status);
CREATE INDEX idx_line_users_userstaff ON line_users(userstaff);
CREATE INDEX idx_line_users_status_register ON line_users(status_register);

-- ============================================
-- BotData Table (Exact Match by item_code, alternative_key_1, alternative_key_2)
-- ============================================
CREATE TABLE IF NOT EXISTS botdata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  field_unknown TEXT,
  item_name TEXT NOT NULL,
  lot_number TEXT,
  on_hand_quantity INTEGER DEFAULT 0,
  alternative_key_1 TEXT,
  alternative_key_2 TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
);

CREATE INDEX idx_botdata_item_code ON botdata(item_code);
CREATE INDEX idx_botdata_alt_key_1 ON botdata(alternative_key_1);
CREATE INDEX idx_botdata_alt_key_2 ON botdata(alternative_key_2);
CREATE INDEX idx_botdata_item_name ON botdata(item_name);

-- ============================================
-- InventData Table (Partial Search by item_name)
-- ============================================
CREATE TABLE IF NOT EXISTS inventdata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  stock_quantity INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
);

CREATE INDEX idx_inventdata_item_name ON inventdata(item_name);
CREATE INDEX idx_inventdata_item_name_gin ON inventdata USING gin(item_name gin_trgm_ops);

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Reply Templates Table (Multiple types)
-- ============================================
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT UNIQUE NOT NULL,
  reply_type TEXT DEFAULT 'text' CHECK (reply_type IN ('text', 'textv2', 'flex', 'template', 'telegram')),
  reply_content TEXT NOT NULL,
  reply_content_2 TEXT, -- For telegram type
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
);

CREATE INDEX idx_reply_templates_keyword ON reply_templates(keyword);
CREATE INDEX idx_reply_templates_active ON reply_templates(is_active);

-- ============================================
-- System Settings Table (All switches)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('bot_enabled', 'true', 'B20: Enable/disable LINE bot'),
  ('stock_enabled', 'true', 'B21: Enable/disable stock queries'),
  ('stock_require_approval', 'true', 'B22: Require approval for stock queries'),
  ('register_required', 'true', 'B23: Require user registration'),
  ('line_channel_token', '', 'LINE Channel Access Token'),
  ('line_channel_secret', '', 'LINE Channel Secret'),
  ('line_bot_basic_id', '', 'LINE Bot Basic ID'),
  ('rich_menu_id', '', 'LINE Rich Menu ID')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Cache Management Table
-- ============================================
CREATE TABLE IF NOT EXISTS cache_metadata (
  key TEXT PRIMARY KEY,
  data_type TEXT NOT NULL, -- 'botdata' or 'inventdata'
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl_seconds INTEGER DEFAULT 1800, -- 30 minutes
  item_count INTEGER DEFAULT 0,
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE botdata ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventdata ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies for line_users
CREATE POLICY "Users can view own data" ON line_users
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own data" ON line_users
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own data" ON line_users
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can access all line_users" ON line_users
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for botdata (public read, service write)
CREATE POLICY "Public can view botdata" ON botdata
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage botdata" ON botdata
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for inventdata (public read, service write)
CREATE POLICY "Public can view inventdata" ON inventdata
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage inventdata" ON inventdata
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for reply_templates (public read active, service write)
CREATE POLICY "Public can view active reply_templates" ON reply_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage reply_templates" ON reply_templates
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for system_settings (public read, service write)
CREATE POLICY "Public can view system_settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage system_settings" ON system_settings
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for cache_metadata (service only)
CREATE POLICY "Service role can manage cache_metadata" ON cache_metadata
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
DROP TRIGGER IF EXISTS update_botdata_updated_at ON botdata;
CREATE TRIGGER update_botdata_updated_at
  BEFORE UPDATE ON botdata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventdata_updated_at ON inventdata;
CREATE TRIGGER update_inventdata_updated_at
  BEFORE UPDATE ON inventdata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reply_templates_updated_at ON reply_templates;
CREATE TRIGGER update_reply_templates_updated_at
  BEFORE UPDATE ON reply_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Get system setting value
CREATE OR REPLACE FUNCTION get_setting(setting_key TEXT)
RETURNS TEXT AS $$
  SELECT value FROM system_settings WHERE key = setting_key;
$$ LANGUAGE sql STABLE;

-- Check if bot is enabled
CREATE OR REPLACE FUNCTION is_bot_enabled()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT value = 'true' FROM system_settings WHERE key = 'bot_enabled'),
    true
  );
$$ LANGUAGE sql STABLE;

-- Check if stock is enabled
CREATE OR REPLACE FUNCTION is_stock_enabled()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT value = 'true' FROM system_settings WHERE key = 'stock_enabled'),
    true
  );
$$ LANGUAGE sql STABLE;

-- Check if stock requires approval
CREATE OR REPLACE FUNCTION is_stock_require_approval()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT value = 'true' FROM system_settings WHERE key = 'stock_require_approval'),
    true
  );
$$ LANGUAGE sql STABLE;

-- Check if registration is required
CREATE OR REPLACE FUNCTION is_register_required()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT value = 'true' FROM system_settings WHERE key = 'register_required'),
    true
  );
$$ LANGUAGE sql STABLE;

-- Check if user can ask stock (considering approval requirement)
CREATE OR REPLACE FUNCTION can_user_ask_stock(user_id_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_row line_users%ROWTYPE;
  stock_enabled BOOLEAN;
  require_approval BOOLEAN;
BEGIN
  -- Check if stock is enabled
  stock_enabled := is_stock_enabled();
  IF NOT stock_enabled THEN
    RETURN false;
  END IF;

  -- Check if approval is required
  require_approval := is_stock_require_approval();
  IF NOT require_approval THEN
    RETURN true;
  END IF;

  -- Check user permission
  SELECT * INTO user_row FROM line_users WHERE user_id = user_id_param;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN user_row.userstaff IN ('admin', 'customer');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Grant Permissions
-- ============================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON line_users, botdata, inventdata, reply_templates, system_settings TO authenticated;
GRANT INSERT, UPDATE ON line_users TO authenticated;

-- Grant access to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================
-- Sample Data (Optional - Comment out for production)
-- ============================================

-- Insert sample botdata items
-- INSERT INTO botdata (item_code, item_name, lot_number, on_hand_quantity, alternative_key_1, alternative_key_2) VALUES
--   ('001-01-NH112-P-SIL', '001-01-NH112-P-SIL : CIVIC FD (06-11) 0 000', '25024', 5, 'NH112', 'CIVIC FD'),
--   ('001-01-NH132-P-SIL', '001-01-NH132-P-SIL : HD CIVIC FB', '25023', 3, 'NH132', 'CIVIC FB')
-- ON CONFLICT DO NOTHING;

-- Insert sample inventdata items
-- INSERT INTO inventdata (item_name, stock_quantity) VALUES
--   ('001-01-NH112-P-SIL : CIVIC FD (06-11)', 5),
--   ('001-01-NH132-P-SIL : HD CIVIC FB', 3)
-- ON CONFLICT DO NOTHING;

-- Insert sample reply templates
INSERT INTO reply_templates (keyword, reply_type, reply_content) VALUES
  ('ราคา', 'text', '📋 กรุณาระบุ SKU หรือชื่อสินค้าที่ต้องการทราบราคา'),
  ('หมด', 'text', '📦 รายการสินค้าที่หมด กรุณาติดต่อแอดมิน'),
  ('ช่วยเหลือ', 'text', '📞 ติดต่อแอดมิน:\nโทร: 02-XXX-XXXX\nLINE: @boonyang')
ON CONFLICT (keyword) DO NOTHING;
