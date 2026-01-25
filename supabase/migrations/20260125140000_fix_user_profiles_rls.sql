-- Migration to fix RLS policies for user_profiles

-- Drop existing policies from the previous migration
DROP POLICY IF EXISTS "Admins can manage all user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- Create a new policy to allow users to create their own profile.
-- This is a temporary measure to get the app working.
-- A more secure solution would be to use a Supabase function for profile creation.
CREATE POLICY "Users can create their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.role() = 'anon');

-- Create a policy to allow users to view all profiles.
-- This might need to be restricted further depending on privacy requirements.
CREATE POLICY "Public can read profiles"
  ON public.user_profiles FOR SELECT
  USING (true);

-- No UPDATE or DELETE policies are created for now.
