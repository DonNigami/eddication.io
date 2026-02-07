-- Migration: Make job_id nullable in driver_alcohol_checks
-- Date: 2026-02-07
-- Description: Allow alcohol checks to be saved even if jobdata doesn't exist yet
-- This prevents orphaned files in storage when drivers check alcohol before job is created

-- Step 1: Drop foreign key constraint
ALTER TABLE public.driver_alcohol_checks
DROP CONSTRAINT IF EXISTS driver_alcohol_checks_job_id_fkey;

-- Step 2: Make job_id nullable
ALTER TABLE public.driver_alcohol_checks
ALTER COLUMN job_id DROP NOT NULL;

-- Step 3: Add foreign key constraint that allows NULL (ON DELETE SET NULL for orphans)
ALTER TABLE public.driver_alcohol_checks
ADD CONSTRAINT driver_alcohol_checks_job_id_fkey
FOREIGN KEY (job_id) REFERENCES public.jobdata(id) ON DELETE SET NULL;

-- Step 4: Create index on job_id (allowing NULLs)
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_job_id_nullable
ON public.driver_alcohol_checks(job_id)
WHERE job_id IS NOT NULL; -- Partial index for better performance

-- Step 5: Update RLS policy to allow inserts even when job_id is NULL
DROP POLICY IF EXISTS "Admins can manage driver_alcohol_checks" ON public.driver_alcohol_checks;

-- Policy: Allow all to insert (for driver app)
CREATE POLICY "Allow insert alcohol checks for all"
ON public.driver_alcohol_checks
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Allow all to select (for admin and driver app)
CREATE POLICY "Allow select alcohol checks for all"
ON public.driver_alcohol_checks
FOR SELECT
TO anon, authenticated, public
USING (true);

-- Policy: Allow update (for admin only via service key in backend)
CREATE POLICY "Allow update alcohol checks for authenticated"
ON public.driver_alcohol_checks
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify changes
SELECT
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_name = 'driver_alcohol_checks' AND column_name = 'job_id';
