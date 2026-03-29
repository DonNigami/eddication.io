-- ============================================
-- Boonyang Inventory System
-- LINE Bot Database Schema
-- ============================================

-- LINE Users Table
CREATE TABLE IF NOT EXISTS line_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL, -- LINE User ID
  display_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
);

CREATE INDEX IF NOT EXISTS idx_line_users_user_id ON line_users(user_id);
CREATE INDEX IF NOT EXISTS idx_line_users_status ON line_users(status);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_th TEXT,
  description TEXT,
  stock_qty INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'ชิ้น',
  location TEXT,
  category TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
);

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_name_th ON inventory(name_th);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- Reply Templates Table
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT UNIQUE NOT NULL,
  reply_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
);

CREATE INDEX IF NOT EXISTS idx_reply_templates_keyword ON reply_templates(keyword);
CREATE INDEX IF NOT EXISTS idx_reply_templates_active ON reply_templates(is_active);

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('bot_enabled', 'true', 'Enable/disable LINE bot'),
  ('require_registration', 'true', 'Require user registration'),
  ('allow_stock_query', 'true', 'Allow users to query stock')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for line_users
CREATE POLICY "Users can view own data" ON line_users
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own data" ON line_users
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own data" ON line_users
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Service role can access all line_users" ON line_users
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for inventory (public read, service write)
CREATE POLICY "Public can view inventory" ON inventory
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage inventory" ON inventory
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for reply_templates (public read, service write)
CREATE POLICY "Public can view reply_templates" ON reply_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage reply_templates" ON reply_templates
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for system_settings (public read, service write)
CREATE POLICY "Public can view system_settings" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage system_settings" ON system_settings
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
CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reply_templates_updated_at
  BEFORE UPDATE ON reply_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Sample Data (Optional)
-- ============================================

-- Insert sample inventory items
INSERT INTO inventory (sku, name, name_th, stock_qty, unit, category) VALUES
  ('SKU001', 'Product A', 'สินค้า เอ', 100, 'ชิ้น', 'Electronics'),
  ('SKU002', 'Product B', 'สินค้า บี', 50, 'ชิ้น', 'Electronics'),
  ('SKU003', 'Product C', 'สินค้า ซี', 0, 'ชิ้น', 'Accessories')
ON CONFLICT (sku) DO NOTHING;

-- Insert sample reply templates
INSERT INTO reply_templates (keyword, reply_content) VALUES
  ('ราคา', '📋 กรุณาระบุ SKU หรือชื่อสินค้าที่ต้องการทราบราคา'),
  ('หมด', '📦 รายการสินค้าที่หมด:\n\nSKU001 - สินค้า บี (คงเหลือ: 0)'),
  ('ช่วยเหลือ', '📞 ติดต่อแอดมิน:\nโทร: 02-XXX-XXXX\nLINE: @boonyang')
ON CONFLICT (keyword) DO NOTHING;

-- ============================================
-- Grant Permissions
-- ============================================

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON line_users, inventory, reply_templates, system_settings TO authenticated;
GRANT INSERT, UPDATE ON line_users TO authenticated;

-- Grant access to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
