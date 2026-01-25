-- =====================================================
-- Fix RLS Policies for Driver App (LIFF-based Auth)
-- =====================================================
-- The driver app uses LIFF ID as user identifier WITHOUT
-- Supabase Auth. This means auth.role() = 'anon' always.
--
-- This migration adds anon-friendly policies for:
-- - driver_logs (audit trail)
-- - driver_alcohol_checks (alcohol tests)
-- - alcohol-evidence storage bucket
-- =====================================================

-- =====================================================
-- 1. Fix driver_logs table - Allow anon inserts
-- =====================================================

-- Drop the authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.driver_logs;

-- Allow anon users to insert logs (for driver app audit trail)
CREATE POLICY "Anon users can insert driver logs"
  ON public.driver_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to select logs
CREATE POLICY "Anon users can view logs by reference"
  ON public.driver_logs FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 2. Fix driver_alcohol_checks table - Allow anon inserts
-- =====================================================

-- Drop existing admin-only policy if it blocks anon
DROP POLICY IF EXISTS "Admins can manage driver_alcohol_checks" ON public.driver_alcohol_checks;

-- Allow anon users to insert alcohol checks
CREATE POLICY "Anon users can insert alcohol checks"
  ON public.driver_alcohol_checks FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to select alcohol checks
CREATE POLICY "Anon users can view alcohol checks by reference"
  ON public.driver_alcohol_checks FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 3. Fix jobdata table - Allow anon updates
-- =====================================================

-- Drop policy if exists, then create
DROP POLICY IF EXISTS "Anon users can update jobdata" ON public.jobdata;

-- Allow anon users to update jobdata (checkin/checkout)
CREATE POLICY "Anon users can update jobdata"
  ON public.jobdata FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. Fix user_profiles table - Allow anon inserts/updates
-- =====================================================

-- Drop policies if exist
DROP POLICY IF EXISTS "Anon users can insert their profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Anon users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Anon users can view profiles" ON public.user_profiles;

-- Allow anon users to insert their profile (on first visit)
CREATE POLICY "Anon users can insert their profile"
  ON public.user_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon users to update their own profile
CREATE POLICY "Anon users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon users to select profiles (for display)
CREATE POLICY "Anon users can view profiles"
  ON public.user_profiles FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 5. Fix process_data table - Allow anon inserts
-- =====================================================

-- Drop policy if exists
DROP POLICY IF EXISTS "Anon users can insert process data" ON public.process_data;

-- Allow anon users to insert process data
CREATE POLICY "Anon users can insert process data"
  ON public.process_data FOR INSERT
  TO anon
  WITH CHECK (true);

-- =====================================================
-- 6. Fix alcohol-evidence storage bucket policies
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access for alcohol-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to alcohol-evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon updates to alcohol-evidence" ON storage.objects;

-- Allow anon (public) read access
CREATE POLICY "Public read access for alcohol-evidence"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'alcohol-evidence');

-- Allow anon uploads
CREATE POLICY "Allow anon uploads to alcohol-evidence"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'alcohol-evidence');

-- Allow anon updates (overwrite)
CREATE POLICY "Allow anon updates to alcohol-evidence"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'alcohol-evidence')
  WITH CHECK (bucket_id = 'alcohol-evidence');

-- =====================================================
-- 7. Fix origin table - Allow anon selects (for GPS coords)
-- =====================================================

DROP POLICY IF EXISTS "Anon users can view origin" ON public.origin;

CREATE POLICY "Anon users can view origin"
  ON public.origin FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 8. Fix customer table - Allow anon selects (for GPS coords)
-- =====================================================

DROP POLICY IF EXISTS "Anon users can view customer" ON public.customer;

CREATE POLICY "Anon users can view customer"
  ON public.customer FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 9. Fix driver_jobs table - Allow anon selects (for search)
-- =====================================================

DROP POLICY IF EXISTS "Anon users can view driver_jobs" ON public.driver_jobs;

CREATE POLICY "Anon users can view driver_jobs"
  ON public.driver_jobs FOR SELECT
  TO anon
  USING (true);

-- =====================================================
-- 10. Ensure storage bucket exists
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alcohol-evidence',
  'alcohol-evidence',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

SELECT 'RLS policies fixed for LIFF-based driver app (anon access enabled)' as status;
