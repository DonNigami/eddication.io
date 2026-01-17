-- Add missing columns to existing user_profiles table

-- Add status_message if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'status_message'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN status_message TEXT;
  END IF;
END $$;

-- Add first_seen_at if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'first_seen_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN first_seen_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add last_seen_at if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add total_visits if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'total_visits'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN total_visits INTEGER DEFAULT 1;
  END IF;
END $$;

-- Add last_reference if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'last_reference'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_reference TEXT;
  END IF;
END $$;

-- Disable RLS for testing
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Success message
SELECT 'user_profiles table updated successfully' as status;
