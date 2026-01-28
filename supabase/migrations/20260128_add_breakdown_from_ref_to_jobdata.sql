-- Add breakdown_from_ref column to jobdata table
-- Migration: 20260128_add_breakdown_from_ref_to_jobdata.sql

-- Add column to track original reference when a job is created from vehicle breakdown
ALTER TABLE public.jobdata
ADD COLUMN IF NOT EXISTS breakdown_from_ref TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobdata_breakdown_from_ref ON public.jobdata(breakdown_from_ref);

-- Add comment
COMMENT ON COLUMN public.jobdata.breakdown_from_ref IS 'Original reference when this job was created from a vehicle breakdown (format: original-shipToName)';
