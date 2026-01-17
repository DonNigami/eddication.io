-- Check existing user_profiles table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'user_profiles';

-- Show existing policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_profiles';

-- Show sample data (last 5 users)
SELECT 
  user_id,
  display_name,
  first_seen_at,
  last_seen_at,
  total_visits,
  last_reference
FROM user_profiles
ORDER BY last_seen_at DESC
LIMIT 5;
