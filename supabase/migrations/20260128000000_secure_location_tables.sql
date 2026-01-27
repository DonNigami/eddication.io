-- =====================================================
-- SECURE LOCATION TABLES RLS POLICIES
-- Run this in Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql
-- =====================================================

-- =====================================================
-- ORIGIN TABLE POLICIES
-- =====================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow public read on origin" ON public.origin;
DROP POLICY IF EXISTS "Allow service insert on origin" ON public.origin;
DROP POLICY IF EXISTS "Allow service update on origin" ON public.origin;
DROP POLICY IF EXISTS "Allow service delete on origin" ON public.origin;

-- Allow authenticated users to read origins
CREATE POLICY "Authenticated users can read origins" ON public.origin
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage origins
CREATE POLICY "Service role can insert origins" ON public.origin
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update origins" ON public.origin
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete origins" ON public.origin
  FOR DELETE USING (auth.role() = 'service_role');

-- =====================================================
-- CUSTOMER TABLE POLICIES
-- =====================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow public read on customer" ON public.customer;
DROP POLICY IF EXISTS "Allow service insert on customer" ON public.customer;
DROP POLICY IF EXISTS "Allow service update on customer" ON public.customer;
DROP POLICY IF EXISTS "Allow service delete on customer" ON public.customer;

-- Allow authenticated users to read customers
CREATE POLICY "Authenticated users can read customers" ON public.customer
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage customers
CREATE POLICY "Service role can insert customers" ON public.customer
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update customers" ON public.customer
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete customers" ON public.customer
  FOR DELETE USING (auth.role() = 'service_role');

-- =====================================================
-- STATION TABLE POLICIES
-- =====================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow public read on station" ON public.station;
DROP POLICY IF EXISTS "Allow service insert on station" ON public.station;
DROP POLICY IF EXISTS "Allow service update on station" ON public.station;
DROP POLICY IF EXISTS "Allow service delete on station" ON public.station;

-- Allow authenticated users to read stations
CREATE POLICY "Authenticated users can read stations" ON public.station
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage stations
CREATE POLICY "Service role can insert stations" ON public.station
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update stations" ON public.station
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete stations" ON public.station
  FOR DELETE USING (auth.role() = 'service_role');

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify policies are in place
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('origin', 'customer', 'station')
ORDER BY tablename, policyname;
