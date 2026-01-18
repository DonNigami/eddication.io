-- Add vehicle breakdown tracking columns to driver_jobs
-- Migration: 20260119_add_vehicle_breakdown_columns.sql

ALTER TABLE public.driver_jobs
ADD COLUMN IF NOT EXISTS is_vehicle_breakdown BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS breakdown_reason TEXT,
ADD COLUMN IF NOT EXISTS original_job_id UUID REFERENCES public.driver_jobs(id),
ADD COLUMN IF NOT EXISTS replacement_job_id UUID;

-- Create index for faster breakdown queries
CREATE INDEX IF NOT EXISTS idx_driver_jobs_is_vehicle_breakdown ON public.driver_jobs(is_vehicle_breakdown) WHERE is_vehicle_breakdown = TRUE;
CREATE INDEX IF NOT EXISTS idx_driver_jobs_original_job_id ON public.driver_jobs(original_job_id) WHERE original_job_id IS NOT NULL;
