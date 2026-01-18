-- Add B100 job tracking columns to driver_jobs
-- Migration: 20260119_add_b100_job_columns.sql

ALTER TABLE public.driver_jobs
ADD COLUMN IF NOT EXISTS is_b100 BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS b100_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS b100_status TEXT DEFAULT 'pending' CHECK (b100_status IN ('pending', 'paid', 'outstanding'));

-- Create indexes for B100 queries
CREATE INDEX IF NOT EXISTS idx_driver_jobs_is_b100 ON public.driver_jobs(is_b100) WHERE is_b100 = TRUE;
CREATE INDEX IF NOT EXISTS idx_driver_jobs_b100_status ON public.driver_jobs(b100_status) WHERE is_b100 = TRUE;

-- Create a view for B100 outstanding summary by driver
CREATE OR REPLACE VIEW public.v_b100_outstanding_by_driver AS
SELECT
    drivers,
    COUNT(*) as outstanding_jobs_count,
    SUM(b100_amount) as total_outstanding_amount,
    MAX(created_at) as last_job_date
FROM public.driver_jobs
WHERE is_b100 = TRUE AND b100_status = 'outstanding'
GROUP BY drivers;
