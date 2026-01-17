-- ⚠️ URGENT: Create driver_jobs table to fix Error 406
-- Run this SQL in Supabase SQL Editor immediately
-- This will fix: GET /rest/v1/driver_jobs 406 (Not Acceptable)

-- ============================================
-- 1. Create driver_jobs table
-- ============================================
CREATE TABLE IF NOT EXISTS public.driver_jobs (
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
  updated_by TEXT,
  
  -- Additional fields for compatibility
  ship_to TEXT,
  ship_to_name TEXT,
  ship_to_address TEXT,
  delivery_qty NUMERIC,
  material_desc TEXT,
  route TEXT,
  delivery TEXT,
  material TEXT,
  delivery_item TEXT,
  shipment_no TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_jobs_reference ON public.driver_jobs(reference);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_status ON public.driver_jobs(status);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_created_at ON public.driver_jobs(created_at DESC);

-- ============================================
-- 2. Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE public.driver_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Drop ALL existing policies first
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
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.driver_jobs';
    END LOOP;
END $$;

-- ============================================
-- 4. Create simple allow-all policies
-- ============================================
CREATE POLICY "driver_jobs_allow_all_select"
  ON public.driver_jobs
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

CREATE POLICY "driver_jobs_allow_all_insert"
  ON public.driver_jobs
  FOR INSERT
  TO public, anon, authenticated
  WITH CHECK (true);

CREATE POLICY "driver_jobs_allow_all_update"
  ON public.driver_jobs
  FOR UPDATE
  TO public, anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "driver_jobs_allow_all_delete"
  ON public.driver_jobs
  FOR DELETE
  TO public, anon, authenticated
  USING (true);

-- ============================================
-- 5. Create driver_stops table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.driver_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.driver_jobs(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  stop_number INTEGER NOT NULL,
  stop_name TEXT,
  address TEXT,
  
  checkin_time TIMESTAMPTZ,
  checkin_location JSONB,
  checkin_by TEXT,
  
  fuel_time TIMESTAMPTZ,
  fuel_location JSONB,
  fuel_odo INTEGER,
  fuel_by TEXT,
  
  unload_time TIMESTAMPTZ,
  unload_location JSONB,
  unload_receiver TEXT,
  unload_by TEXT,
  
  checkout_time TIMESTAMPTZ,
  checkout_location JSONB,
  checkout_odo INTEGER,
  checkout_by TEXT,
  
  status TEXT DEFAULT 'pending',
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_stops_job_id ON public.driver_stops(job_id);
CREATE INDEX IF NOT EXISTS idx_driver_stops_reference ON public.driver_stops(reference);
CREATE INDEX IF NOT EXISTS idx_driver_stops_stop_number ON public.driver_stops(stop_number);

-- Enable RLS
ALTER TABLE public.driver_stops ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'driver_stops' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.driver_stops';
    END LOOP;
END $$;

-- Create policies
CREATE POLICY "driver_stops_allow_all_select" ON public.driver_stops FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "driver_stops_allow_all_insert" ON public.driver_stops FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "driver_stops_allow_all_update" ON public.driver_stops FOR UPDATE TO public, anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "driver_stops_allow_all_delete" ON public.driver_stops FOR DELETE TO public, anon, authenticated USING (true);

-- ============================================
-- 6. Create driver_alcohol_checks table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.driver_alcohol_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  reference TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  alcohol_value NUMERIC(4,3) NOT NULL,
  image_url TEXT,
  location JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alcohol_checks_reference ON public.driver_alcohol_checks(reference);
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_checked_at ON public.driver_alcohol_checks(checked_at DESC);

-- Enable RLS
ALTER TABLE public.driver_alcohol_checks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'driver_alcohol_checks' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.driver_alcohol_checks';
    END LOOP;
END $$;

-- Create policies
CREATE POLICY "alcohol_checks_allow_all_select" ON public.driver_alcohol_checks FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "alcohol_checks_allow_all_insert" ON public.driver_alcohol_checks FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "alcohol_checks_allow_all_update" ON public.driver_alcohol_checks FOR UPDATE TO public, anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "alcohol_checks_allow_all_delete" ON public.driver_alcohol_checks FOR DELETE TO public, anon, authenticated USING (true);

-- ============================================
-- 7. Create driver_logs table (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.driver_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  reference TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  location JSONB,
  user_id TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_logs_reference ON public.driver_logs(reference);
CREATE INDEX IF NOT EXISTS idx_driver_logs_action ON public.driver_logs(action);
CREATE INDEX IF NOT EXISTS idx_driver_logs_created_at ON public.driver_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.driver_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'driver_logs' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.driver_logs';
    END LOOP;
END $$;

-- Create policies
CREATE POLICY "driver_logs_allow_all_select" ON public.driver_logs FOR SELECT TO public, anon, authenticated USING (true);
CREATE POLICY "driver_logs_allow_all_insert" ON public.driver_logs FOR INSERT TO public, anon, authenticated WITH CHECK (true);
CREATE POLICY "driver_logs_allow_all_update" ON public.driver_logs FOR UPDATE TO public, anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "driver_logs_allow_all_delete" ON public.driver_logs FOR DELETE TO public, anon, authenticated USING (true);

-- ============================================
-- 8. Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_driver_jobs_updated_at ON public.driver_jobs;
CREATE TRIGGER update_driver_jobs_updated_at
  BEFORE UPDATE ON public.driver_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_stops_updated_at ON public.driver_stops;
CREATE TRIGGER update_driver_stops_updated_at
  BEFORE UPDATE ON public.driver_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 9. Create Storage Bucket for alcohol images
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('alcohol-checks', 'alcohol-checks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DO $$ 
BEGIN
    -- Drop existing storage policies
    DROP POLICY IF EXISTS "Allow public upload to alcohol-checks" ON storage.objects;
    DROP POLICY IF EXISTS "Allow public read from alcohol-checks" ON storage.objects;
    
    -- Create new policies
    CREATE POLICY "Allow public upload to alcohol-checks"
    ON storage.objects FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (bucket_id = 'alcohol-checks');

    CREATE POLICY "Allow public read from alcohol-checks"
    ON storage.objects FOR SELECT
    TO public, anon, authenticated
    USING (bucket_id = 'alcohol-checks');
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Storage policies may already exist or storage not available';
END $$;

-- ============================================
-- 10. Insert sample data for testing
-- ============================================
INSERT INTO public.driver_jobs (reference, vehicle_desc, drivers, status, start_odo)
VALUES 
  ('TEST-001', 'กข-1234 กรุงเทพฯ', 'นายทดสอบ ระบบ', 'active', 10000),
  ('2601M01559', 'กท-5678 ขอนแก่น', 'นายสมชาย ใจดี, นายสมศักดิ์ มีชัย', 'active', 15000)
ON CONFLICT (reference) DO NOTHING;

-- ============================================
-- 11. Verify everything
-- ============================================
SELECT 
  'driver_jobs' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'driver_jobs') as policy_count
FROM public.driver_jobs
UNION ALL
SELECT 
  'driver_stops' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'driver_stops') as policy_count
FROM public.driver_stops
UNION ALL
SELECT 
  'driver_alcohol_checks' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'driver_alcohol_checks') as policy_count
FROM public.driver_alcohol_checks
UNION ALL
SELECT 
  'driver_logs' as table_name,
  COUNT(*) as row_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'driver_logs') as policy_count
FROM public.driver_logs;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 
  '✅ SUCCESS: All driver_* tables created with RLS policies' as status,
  'Error 406 should be fixed now. Try searching for reference "2601M01559" or "TEST-001"' as next_step;
