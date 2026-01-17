-- Allow duplicate reference values in driver_jobs table
-- Created: 2026-01-17
-- Purpose: Remove UNIQUE constraint from reference column to allow importing all rows

-- ============================================
-- Drop UNIQUE constraint from reference column
-- ============================================

-- Drop the existing unique constraint
ALTER TABLE driver_jobs DROP CONSTRAINT IF EXISTS driver_jobs_reference_key;

-- Keep the index for performance but not as unique
DROP INDEX IF EXISTS idx_driver_jobs_reference;
CREATE INDEX IF NOT EXISTS idx_driver_jobs_reference ON driver_jobs(reference);

-- ============================================
-- Note: reference can now have duplicate values
-- This allows importing all rows from Google Sheet
-- without skipping or modifying references
-- ============================================
