-- Migration: Add confirmed driver columns to jobdata table
-- Description: Add fields to store the confirmed driver names when closing a job
-- Created: 2025-01-31

-- Add confirmed_driver1 column (required when closing job)
ALTER TABLE jobdata
ADD COLUMN IF NOT EXISTS confirmed_driver1 TEXT;

-- Add confirmed_driver2 column (optional, nullable)
ALTER TABLE jobdata
ADD COLUMN IF NOT EXISTS confirmed_driver2 TEXT;

-- Add index for faster queries on confirmed drivers
CREATE INDEX IF NOT EXISTS idx_jobdata_confirmed_driver1 ON jobdata(confirmed_driver1);
CREATE INDEX IF NOT EXISTS idx_jobdata_confirmed_driver2 ON jobdata(confirmed_driver2);

-- Add comment for documentation
COMMENT ON COLUMN jobdata.confirmed_driver1 IS 'Name of the first confirmed driver when closing the job';
COMMENT ON COLUMN jobdata.confirmed_driver2 IS 'Name of the second confirmed driver (if any) when closing the job';
