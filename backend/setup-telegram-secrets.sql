-- Setup Telegram credentials in Supabase Secrets
-- Run this in Supabase SQL Editor

-- Create a function to safely retrieve Telegram configuration
CREATE OR REPLACE FUNCTION get_telegram_config()
RETURNS json AS $$
DECLARE
  token text;
  chat_id text;
BEGIN
  -- Get secrets from Supabase
  token := current_setting('app.settings.telegram_bot_token', true);
  chat_id := current_setting('app.settings.telegram_chat_id', true);
  
  RETURN json_build_object(
    'telegram_bot_token', token,
    'telegram_chat_id', chat_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission to anon role to call this function
GRANT EXECUTE ON FUNCTION get_telegram_config() TO anon;

-- Alternative: Store in a single row configuration table
CREATE TABLE IF NOT EXISTS admin_config (
  id int PRIMARY KEY DEFAULT 1,
  telegram_bot_token text,
  telegram_chat_id text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow reads from backend (should be authenticated)
CREATE POLICY "Allow authenticated reads" ON admin_config
  FOR SELECT USING (true);

-- Insert default row
INSERT INTO admin_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- NOTE: Update Telegram credentials using:
-- UPDATE admin_config SET telegram_bot_token = 'YOUR_TOKEN', telegram_chat_id = 'YOUR_CHAT_ID' WHERE id = 1;
