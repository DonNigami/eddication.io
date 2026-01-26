/**
 * Direct SQL Execution via Supabase REST API
 * Run: node apply-sql.js
 */

import { readFileSync } from 'fs';

// Load config from shared/config.js to get Supabase credentials
const configContent = readFileSync('./PTGLG/driverconnect/shared/config.js', 'utf-8');

// Extract SUPABASE_URL and SUPABASE_ANON_KEY
const supabaseUrlMatch = configContent.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const supabaseKeyMatch = configContent.match(/const SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

const SUPABASE_URL = supabaseUrlMatch ? supabaseUrlMatch[1] : null;
const SUPABASE_KEY = supabaseKeyMatch ? supabaseKeyMatch[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Could not extract Supabase credentials from config.js');
  process.exit(1);
}

console.log('Supabase URL:', SUPABASE_URL);
console.log('Project ID:', SUPABASE_URL.match(/\/\/([^\.]+)/)?.[1]);

// The SQL to apply - station table with stationKey column
const migrationSQL = `
-- Create station table with stationKey column if not exists
CREATE TABLE IF NOT EXISTS public.station (
  station_name TEXT,
  mobile TEXT,
  "Name_Area" TEXT,
  "Phone_Area" TEXT,
  "Name_Region" TEXT,
  "Phone_Region" TEXT,
  GPS TEXT,
  time_open TEXT,
  depot_name TEXT,
  "plant code" TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "radiusMeters" BIGINT DEFAULT 100,
  name TEXT GENERATED ALWAYS AS (station_name) STORED,
  "stationKey" TEXT NOT NULL,
  constraint station_pkey primary key ("plant code", "stationKey")
);

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
`;

// PTC station data with coordinates
const stationDataSQL = `
-- Add PTC stations with coordinates
INSERT INTO public.station (station_name, "plant code", "stationKey", lat, lng, "radiusMeters")
VALUES
  ('ท่าทราย 2', 'PTC', 'PTC-STA-ท่าทราย 2', 13.9256, 100.7895, 100),
  ('ปากเกร็ด', 'PTC', 'PTC-STA-ปากเกร็ด', 13.9156, 100.5297, 100)
ON CONFLICT ("plant code", "stationKey") DO UPDATE SET
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  "radiusMeters" = EXCLUDED."radiusMeters";
`;

console.log('\n⚠️  This script requires your DATABASE_PASSWORD to execute SQL directly.');
console.log('\nTo apply the migration, run this SQL in Supabase Dashboard > SQL Editor:\n');
console.log('='.repeat(60));
console.log(migrationSQL);
console.log(stationDataSQL);
console.log('='.repeat(60));
console.log('\nOr open: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql\n');
