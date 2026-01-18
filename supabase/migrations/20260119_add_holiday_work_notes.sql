-- Add holiday work notes to jobdata and driver_jobs tables
-- Migration: 20260119_add_holiday_work_notes.sql

-- Add holiday_work_notes to jobdata (jobdata already has is_holiday_work)
ALTER TABLE public.jobdata ADD COLUMN IF NOT EXISTS holiday_work_notes TEXT;

-- Add is_holiday_work and holiday_work_notes to driver_jobs
ALTER TABLE public.driver_jobs ADD COLUMN IF NOT EXISTS is_holiday_work BOOLEAN DEFAULT FALSE;
ALTER TABLE public.driver_jobs ADD COLUMN IF NOT EXISTS holiday_work_notes TEXT;

-- Create index for faster holiday work queries
CREATE INDEX IF NOT EXISTS idx_driver_jobs_is_holiday_work ON public.driver_jobs(is_holiday_work) WHERE is_holiday_work = TRUE;
