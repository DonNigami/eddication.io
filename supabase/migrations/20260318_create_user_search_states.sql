-- Create table for storing user search states
-- This persists state across multiple Edge Function invocations

CREATE TABLE IF NOT EXISTS user_search_states (
  user_id TEXT PRIMARY KEY,
  step TEXT NOT NULL CHECK (step IN ('waiting_brand', 'brand_selected', 'model_selected', 'standard_selected', 'complete')),
  item_name2 TEXT DEFAULT '',
  item_name3 TEXT,
  standard TEXT,
  original_query TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_search_states_updated_at ON user_search_states(updated_at);

-- Enable Row Level Security
ALTER TABLE user_search_states ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to manage their own state
CREATE POLICY "Users can manage their own search state"
ON user_search_states
FOR ALL
USING (auth.uid()::TEXT = user_id)
WITH CHECK (auth.uid()::TEXT = user_id);

-- Create policy to allow service role to manage all states
CREATE POLICY "Service role can manage all search states"
ON user_search_states
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_search_states_updated_at ON user_search_states;
CREATE TRIGGER update_user_search_states_updated_at
  BEFORE UPDATE ON user_search_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE user_search_states IS 'Stores user search state for step-by-step parts search flow';
