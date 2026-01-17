-- Quick Fix: Enable public access to driver_jobs table
-- Run this SQL in Supabase SQL Editor

-- ============================================
-- 1. Check if table exists
-- ============================================
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'driver_jobs'
) as table_exists;

-- ============================================
-- 2. If table doesn't exist, create it
-- ============================================
CREATE TABLE IF NOT EXISTS driver_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  vehicle_desc TEXT,
  drivers TEXT,
  status TEXT DEFAULT 'active',
  start_odo INTEGER,
  end_odo INTEGER,
  start_location JSONB,
  end_location JSONB,
  vehicle_status TEXT,
  fees NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE driver_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Drop all existing policies
-- ============================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'driver_jobs' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON driver_jobs';
    END LOOP;
END $$;

-- ============================================
-- 5. Create simple allow-all policies
-- ============================================
CREATE POLICY "Allow all SELECT" ON driver_jobs
  FOR SELECT USING (true);

CREATE POLICY "Allow all INSERT" ON driver_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all UPDATE" ON driver_jobs
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow all DELETE" ON driver_jobs
  FOR DELETE USING (true);

-- ============================================
-- 6. Verify policies
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'driver_jobs' 
AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- Success
-- ============================================
SELECT '✅ RLS policies fixed for driver_jobs table' as status;
