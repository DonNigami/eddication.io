-- =====================================================
-- FIX STATION TABLE COLUMNS
-- =====================================================
-- Adds missing columns to the station table to match
-- the client-side code expectations.
-- =====================================================

-- Add radiusMeters column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station' AND column_name = 'radiusMeters'
  ) THEN
    ALTER TABLE public.station ADD COLUMN "radiusMeters" BIGINT DEFAULT 100;
  END IF;
END $$;

-- Add name column if it doesn't exist (as computed column from station_name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.station ADD COLUMN name TEXT GENERATED ALWAYS AS (station_name) STORED;
  END IF;
END $$;

-- Fix lat column type if it's TEXT instead of DOUBLE PRECISION
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station' AND column_name = 'lat' AND data_type = 'text'
  ) THEN
    -- First, drop the generated column if it exists (depends on station_name)
    ALTER TABLE public.station DROP COLUMN IF EXISTS name;

    -- Convert lat from TEXT to DOUBLE PRECISION
    ALTER TABLE public.station ALTER COLUMN lat TYPE DOUBLE PRECISION USING (lat::DOUBLE PRECISION);
  END IF;
END $$;

-- Recreate name column after lat conversion (if it was dropped)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.station ADD COLUMN name TEXT GENERATED ALWAYS AS (station_name) STORED;
  END IF;
END $$;

-- Update indexes to use the name column
DROP INDEX IF EXISTS public.idx_station_station_name;
CREATE INDEX IF NOT EXISTS idx_station_name ON public.station(name);

COMMENT ON COLUMN public.station.name IS 'Generated column alias for station_name';
COMMENT ON COLUMN public.station."radiusMeters" IS 'Check-in radius in meters (default: 100)';
