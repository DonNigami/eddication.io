-- Create user_profiles table
-- Track all users who open the LIFF app

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL, -- LINE User ID
  display_name TEXT, -- LINE Display Name
  picture_url TEXT, -- LINE Profile Picture URL
  status_message TEXT, -- LINE Status Message
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_visits INTEGER DEFAULT 1,
  last_reference TEXT, -- Last searched reference
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen_at DESC);

-- RLS Policy
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all operations (for testing - adjust in production)
CREATE POLICY "Enable read access for all users" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON user_profiles
  FOR UPDATE USING (true) WITH CHECK (true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success
SELECT 'user_profiles table created successfully' as status;
