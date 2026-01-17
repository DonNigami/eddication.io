-- =====================================================
-- Migration: Rename driver_* tables to trips schema
-- Align with app/PLAN.md specification
-- =====================================================
-- Run this in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new
-- =====================================================

-- Step 1: Rename tables
-- =====================================================

-- Rename driver_jobs -> trips
ALTER TABLE IF EXISTS driver_jobs RENAME TO trips;

-- Rename driver_stops -> trip_stops
ALTER TABLE IF EXISTS driver_stops RENAME TO trip_stops;

-- Rename driver_alcohol_checks -> alcohol_checks
ALTER TABLE IF EXISTS driver_alcohol_checks RENAME TO alcohol_checks;

-- Keep driver_logs as is (audit trail)

-- Step 2: Add/Rename columns in trips table
-- =====================================================

-- Add reference_no column (alias for reference)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'reference_no') THEN
    ALTER TABLE trips ADD COLUMN reference_no text;
    -- Copy data from reference to reference_no
    UPDATE trips SET reference_no = reference WHERE reference_no IS NULL;
    -- Create unique index
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_reference_no ON trips(reference_no);
  END IF;
END $$;

-- Add shipment_nos column (jsonb array)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'shipment_nos') THEN
    ALTER TABLE trips ADD COLUMN shipment_nos jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add driver_ids column (jsonb array of LINE user IDs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'driver_ids') THEN
    ALTER TABLE trips ADD COLUMN driver_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add job_closed column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'job_closed') THEN
    ALTER TABLE trips ADD COLUMN job_closed boolean DEFAULT false;
    -- Set job_closed based on existing status
    UPDATE trips SET job_closed = true WHERE status = 'closed';
  END IF;
END $$;

-- Add trip_ended column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'trip_ended') THEN
    ALTER TABLE trips ADD COLUMN trip_ended boolean DEFAULT false;
    -- Set trip_ended based on existing status
    UPDATE trips SET trip_ended = true WHERE status = 'completed';
  END IF;
END $$;

-- Add start_time column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'start_time') THEN
    ALTER TABLE trips ADD COLUMN start_time timestamptz;
  END IF;
END $$;

-- Add end_time column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'end_time') THEN
    ALTER TABLE trips ADD COLUMN end_time timestamptz;
  END IF;
END $$;

-- Step 3: Add/Rename columns in trip_stops table
-- =====================================================

-- Add sequence column (alias for stop_number)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'sequence') THEN
    ALTER TABLE trip_stops ADD COLUMN sequence integer;
    -- Copy data from stop_number to sequence
    UPDATE trip_stops SET sequence = stop_number WHERE sequence IS NULL;
  END IF;
END $$;

-- Add trip_id column (FK to trips)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'trip_id') THEN
    ALTER TABLE trip_stops ADD COLUMN trip_id uuid;
    -- Update trip_id based on reference match
    UPDATE trip_stops ts SET trip_id = t.id FROM trips t WHERE ts.reference = t.reference;
  END IF;
END $$;

-- Add destination_name column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'destination_name') THEN
    ALTER TABLE trip_stops ADD COLUMN destination_name text;
    -- Copy from stop_name if exists
    UPDATE trip_stops SET destination_name = stop_name WHERE destination_name IS NULL AND stop_name IS NOT NULL;
  END IF;
END $$;

-- Add lat/lng columns for destination
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'lat') THEN
    ALTER TABLE trip_stops ADD COLUMN lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'lng') THEN
    ALTER TABLE trip_stops ADD COLUMN lng double precision;
  END IF;
END $$;

-- Add is_origin column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'is_origin') THEN
    ALTER TABLE trip_stops ADD COLUMN is_origin boolean DEFAULT false;
    -- Set is_origin for stop_number = 1
    UPDATE trip_stops SET is_origin = true WHERE stop_number = 1 OR sequence = 1;
  END IF;
END $$;

-- Add check_in_time column (rename from checkin_time)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'check_in_time') THEN
    ALTER TABLE trip_stops ADD COLUMN check_in_time timestamptz;
    -- Copy from checkin_time if exists
    UPDATE trip_stops SET check_in_time = checkin_time WHERE check_in_time IS NULL AND checkin_time IS NOT NULL;
  END IF;
END $$;

-- Add check_out_time column (rename from checkout_time)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'check_out_time') THEN
    ALTER TABLE trip_stops ADD COLUMN check_out_time timestamptz;
    -- Copy from checkout_time if exists
    UPDATE trip_stops SET check_out_time = checkout_time WHERE check_out_time IS NULL AND checkout_time IS NOT NULL;
  END IF;
END $$;

-- Add fueling_time column (rename from fuel_time)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'fueling_time') THEN
    ALTER TABLE trip_stops ADD COLUMN fueling_time timestamptz;
    -- Copy from fuel_time if exists
    UPDATE trip_stops SET fueling_time = fuel_time WHERE fueling_time IS NULL AND fuel_time IS NOT NULL;
  END IF;
END $$;

-- Add unload_done_time column (rename from unload_time)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'unload_done_time') THEN
    ALTER TABLE trip_stops ADD COLUMN unload_done_time timestamptz;
    -- Copy from unload_time if exists
    UPDATE trip_stops SET unload_done_time = unload_time WHERE unload_done_time IS NULL AND unload_time IS NOT NULL;
  END IF;
END $$;

-- Add check_in_odo column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'check_in_odo') THEN
    ALTER TABLE trip_stops ADD COLUMN check_in_odo numeric;
  END IF;
END $$;

-- Add receiver_name column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'receiver_name') THEN
    ALTER TABLE trip_stops ADD COLUMN receiver_name text;
  END IF;
END $$;

-- Add receiver_type column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'receiver_type') THEN
    ALTER TABLE trip_stops ADD COLUMN receiver_type text;
  END IF;
END $$;

-- Add check_in_lat/check_in_lng columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'check_in_lat') THEN
    ALTER TABLE trip_stops ADD COLUMN check_in_lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_stops' AND column_name = 'check_in_lng') THEN
    ALTER TABLE trip_stops ADD COLUMN check_in_lng double precision;
  END IF;
  -- Extract from checkin_location jsonb if exists
  UPDATE trip_stops SET
    check_in_lat = (checkin_location->>'lat')::double precision,
    check_in_lng = (checkin_location->>'lng')::double precision
  WHERE check_in_lat IS NULL AND checkin_location IS NOT NULL;
END $$;

-- Step 4: Add/Rename columns in alcohol_checks table
-- =====================================================

-- Add trip_id column (FK to trips)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alcohol_checks' AND column_name = 'trip_id') THEN
    ALTER TABLE alcohol_checks ADD COLUMN trip_id uuid;
    -- Update trip_id based on job_id or reference match
    UPDATE alcohol_checks ac SET trip_id = COALESCE(ac.job_id, (SELECT t.id FROM trips t WHERE t.reference = ac.reference LIMIT 1));
  END IF;
END $$;

-- Add driver_user_id column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alcohol_checks' AND column_name = 'driver_user_id') THEN
    ALTER TABLE alcohol_checks ADD COLUMN driver_user_id text;
    -- Copy from checked_by if exists
    UPDATE alcohol_checks SET driver_user_id = checked_by WHERE driver_user_id IS NULL AND checked_by IS NOT NULL;
  END IF;
END $$;

-- Add checked_at column (rename from created_at)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alcohol_checks' AND column_name = 'checked_at') THEN
    ALTER TABLE alcohol_checks ADD COLUMN checked_at timestamptz;
    -- Copy from created_at if exists
    UPDATE alcohol_checks SET checked_at = created_at WHERE checked_at IS NULL AND created_at IS NOT NULL;
  END IF;
END $$;

-- Add lat/lng columns (extract from location jsonb)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alcohol_checks' AND column_name = 'lat') THEN
    ALTER TABLE alcohol_checks ADD COLUMN lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alcohol_checks' AND column_name = 'lng') THEN
    ALTER TABLE alcohol_checks ADD COLUMN lng double precision;
  END IF;
  -- Extract from location jsonb if exists
  UPDATE alcohol_checks SET
    lat = (location->>'lat')::double precision,
    lng = (location->>'lng')::double precision
  WHERE lat IS NULL AND location IS NOT NULL;
END $$;

-- Step 5: Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_trips_reference ON trips(reference);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id ON trip_stops(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_stops_reference ON trip_stops(reference);
CREATE INDEX IF NOT EXISTS idx_trip_stops_sequence ON trip_stops(sequence);
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_trip_id ON alcohol_checks(trip_id);
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_reference ON alcohol_checks(reference);

-- Step 6: Update driver_logs to use trip_id
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_logs' AND column_name = 'trip_id') THEN
    ALTER TABLE driver_logs ADD COLUMN trip_id uuid;
    -- Update trip_id based on job_id or reference match
    UPDATE driver_logs dl SET trip_id = COALESCE(dl.job_id, (SELECT t.id FROM trips t WHERE t.reference = dl.reference LIMIT 1));
  END IF;
END $$;

-- =====================================================
-- Migration Complete!
-- =====================================================
-- After running this migration:
-- 1. Update supabase-api.js to use new table/column names
-- 2. Rename storage bucket: alcohol-checks -> alcohol-evidence
-- 3. Test all CRUD operations
-- =====================================================

SELECT 'Migration completed successfully!' as status;
