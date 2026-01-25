-- Secure RLS Policies for Core Tables
--
-- This migration script replaces the insecure `USING (true)` policies
-- with secure policies for multi-tenant data access based on user roles.
--
-- CRITICAL PREQUISITE:
-- This solution requires a custom claim named 'line_user_id' to be present in the
-- Supabase JWT for every authenticated user. This claim must contain the user's
-- LINE User ID. You must configure this in your Supabase authentication setup,
-- typically by using a trigger on the auth.users table or custom sign-in logic.
--
-- =================================================================
-- Step 1: Helper Functions to get user identity from JWT
-- =================================================================

-- Function to safely get the current user's LINE User ID from the JWT custom claims.
CREATE OR REPLACE FUNCTION get_my_line_user_id()
RETURNS TEXT AS $$
BEGIN
  -- This function assumes you have a 'line_user_id' custom claim in your JWT.
  -- It's essential for linking the Supabase auth user to the application's user profile.
  RETURN auth.jwt()->>'line_user_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION get_my_line_user_id IS 'Gets the current users LINE User ID from the JWT custom claim (line_user_id).';

-- Function to get the user's type ('ADMIN' or 'DRIVER') from their profile.
CREATE OR REPLACE FUNCTION get_my_user_type()
RETURNS TEXT AS $$
DECLARE
    user_type_val TEXT;
BEGIN
    SELECT "user_type" INTO user_type_val
    FROM public.user_profiles
    WHERE user_id = get_my_line_user_id()
    LIMIT 1;
    RETURN user_type_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION get_my_user_type IS 'Gets the current users role (e.g., ADMIN, DRIVER) from their user_profile.';


-- =================================================================
-- Step 2: Secure the 'user_profiles' table
-- =================================================================

-- First, drop the old insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.user_profiles;

-- Enable RLS (it may have been disabled for testing)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

-- Create new secure policies
CREATE POLICY "Admins can manage all user profiles"
  ON public.user_profiles FOR ALL
  USING (get_my_user_type() = 'ADMIN');

CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (user_id = get_my_line_user_id());

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (user_id = get_my_line_user_id());


-- =================================================================
-- Step 3: Secure the 'driver_jobs' table
-- =================================================================

-- Drop old insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.driver_jobs;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.driver_jobs;
DROP POLICY IF EXISTS "Enable update for all users" ON public.driver_jobs;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.driver_jobs;
DROP POLICY IF EXISTS "Allow public read on driver_jobs" ON public.driver_jobs;

-- Enable RLS
ALTER TABLE public.driver_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_jobs FORCE ROW LEVEL SECURITY;

-- Create new secure policies
CREATE POLICY "Admins can manage all driver jobs"
  ON public.driver_jobs FOR ALL
  USING (get_my_user_type() = 'ADMIN');

CREATE POLICY "Drivers can view their assigned jobs"
  ON public.driver_jobs FOR SELECT
  USING (drivers LIKE '%' || get_my_line_user_id() || '%');


-- =================================================================
-- Step 4: Secure the 'jobdata' table
-- =================================================================

-- Drop old insecure policies if they exist from any previous setup
DROP POLICY IF EXISTS "Enable read access for all users" ON public.jobdata;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.jobdata;
DROP POLICY IF EXISTS "Enable update for all users" ON public.jobdata;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.jobdata;

-- Enable RLS
ALTER TABLE public.jobdata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobdata FORCE ROW LEVEL SECURITY;

-- Create new secure policies
CREATE POLICY "Admins can manage all job data"
  ON public.jobdata FOR ALL
  USING (get_my_user_type() = 'ADMIN');

CREATE POLICY "Drivers can view their assigned job data"
  ON public.jobdata FOR SELECT
  USING (drivers LIKE '%' || get_my_line_user_id() || '%');

-- =================================================================
-- Step 5: Secure other related tables (e.g., driver_logs)
-- =================================================================

-- Drop old insecure policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.driver_logs;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.driver_logs;
DROP POLICY IF EXISTS "Enable update for all users" ON public.driver_logs;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.driver_logs;

-- Enable RLS
ALTER TABLE public.driver_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_logs FORCE ROW LEVEL SECURITY;

-- Create new secure policies
CREATE POLICY "Admins can manage all driver logs"
  ON public.driver_logs FOR ALL
  USING (get_my_user_type() = 'ADMIN');

-- Allow users to insert logs. The specific job check will be handled by application logic.
-- A stricter policy would check if the user is assigned to the job they are logging for.
CREATE POLICY "Authenticated users can insert logs"
  ON public.driver_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view logs for their assigned jobs"
  ON public.driver_logs FOR SELECT
  USING (
    get_my_user_type() = 'ADMIN' OR
    EXISTS (
      SELECT 1
      FROM public.jobdata j
      WHERE j.reference = driver_logs.reference
      AND j.drivers LIKE '%' || get_my_line_user_id() || '%'
    )
  );

SELECT 'Secure RLS policies applied successfully.' as status;
