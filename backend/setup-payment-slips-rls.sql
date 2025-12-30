-- Enable public access to payment-slips bucket (for subscription slip uploads)
-- Run this in Supabase SQL Editor or via CLI

-- First, make sure the bucket exists and is public
BEGIN;

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public upload slip" ON storage.objects;
DROP POLICY IF EXISTS "Public read slip" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access" ON storage.objects;

-- Create RLS policies to allow anonymous uploads
-- Policy 1: Allow anyone to upload to payment-slips bucket
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'payment-slips' AND
    auth.role() = 'anon' OR auth.role() = 'authenticated'
);

-- Policy 2: Allow anyone to read from payment-slips bucket
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-slips');

-- Policy 3: Allow users to update their own uploads
CREATE POLICY "Allow user update"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'payment-slips' AND owner = auth.uid())
WITH CHECK (bucket_id = 'payment-slips');

-- Policy 4: Allow authenticated users to delete their uploads
CREATE POLICY "Allow user delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'payment-slips' AND owner = auth.uid());

COMMIT;

-- Verify policies
SELECT policy_name, definition FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
AND definition LIKE '%payment-slips%';
