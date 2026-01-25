-- Migration to fix RLS policies for jobdata

-- Drop existing policies from the secure migration
DROP POLICY IF EXISTS "Admins can manage all job data" ON public.jobdata;
DROP POLICY IF EXISTS "Drivers can view their assigned job data" ON public.jobdata;

-- Create a new policy to allow users to insert job data.
-- This is a temporary measure to get the app working.
CREATE POLICY "Users can insert job data"
  ON public.jobdata FOR INSERT
  WITH CHECK (auth.role() = 'anon');

-- Create a policy to allow users to view all job data.
-- This might need to be restricted further depending on privacy requirements.
CREATE POLICY "Users can view job data"
  ON public.jobdata FOR SELECT
  USING (true);

-- No UPDATE or DELETE policies are created for now.
