-- =====================================================
-- FIX STATION TABLE - ADD MISSING stationKey COLUMN
-- =====================================================
-- Run this if station table already exists but without stationKey
-- =====================================================

-- First, check what columns exist and add missing ones

-- Add stationKey column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station' AND column_name = 'stationKey'
  ) THEN
    -- If table has existing data, we need to handle it differently
    -- Try adding the column first
    BEGIN
      ALTER TABLE public.station ADD COLUMN "stationKey" TEXT;
    EXCEPTION WHEN duplicate_column THEN
      -- Column already exists, ignore
      NULL;
    END;

    -- Update stationKey from plant code if empty
    UPDATE public.station SET "stationKey" = "plant code" || '-' || station_name
    WHERE "stationKey" IS NULL;

    -- Make it NOT NULL after populating
    ALTER TABLE public.station ALTER COLUMN "stationKey" SET NOT NULL;
  END IF;
END $$;

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

-- Create name generated column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.station ADD COLUMN name TEXT GENERATED ALWAYS AS (station_name) STORED;
  END IF;
END $$;

-- Drop primary key constraint if it exists and recreate with stationKey
DO $$
BEGIN
  -- Check if primary key exists on plant code only
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'station_pkey'
  ) THEN
    -- Drop existing primary key
    ALTER TABLE public.station DROP CONSTRAINT station_pkey;

    -- Create new composite primary key
    ALTER TABLE public.station ADD CONSTRAINT station_pkey PRIMARY KEY ("plant code", "stationKey");
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.station ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read on station" ON public.station;
DROP POLICY IF EXISTS "Allow service insert on station" ON public.station;
DROP POLICY IF EXISTS "Allow service update on station" ON public.station;

-- Create policies
CREATE POLICY "Allow public read on station" ON public.station FOR SELECT USING (true);
CREATE POLICY "Allow service insert on station" ON public.station FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on station" ON public.station FOR UPDATE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_station_name ON public.station(name);
CREATE INDEX IF NOT EXISTS idx_station_station_key ON public.station("stationKey");
CREATE INDEX IF NOT EXISTS idx_station_plant_code ON public.station("plant code");

-- =====================================================
-- INSERT PTC STATION DATA WITH COORDINATES
-- =====================================================
INSERT INTO public.station (station_name, "plant code", "stationKey", lat, lng, "radiusMeters")
VALUES
  ('ท่าทราย 2', 'PTC', 'PTC-STA-ท่าทราย 2', 13.9256, 100.7895, 100),
  ('ปากเกร็ด', 'PTC', 'PTC-STA-ปากเกร็ด', 13.9156, 100.5297, 100)
ON CONFLICT ("plant code", "stationKey") DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  "radiusMeters" = EXCLUDED."radiusMeters";

-- Verify the station table
SELECT 'Station table columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'station' AND table_schema = 'public'
ORDER BY ordinal_position;
