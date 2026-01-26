-- =====================================================
-- LOCATION TABLES MIGRATION
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql
-- =====================================================

-- =====================================================
-- TABLE: station
-- =====================================================
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

-- =====================================================
-- TABLE: origin
-- =====================================================
CREATE TABLE IF NOT EXISTS public.origin (
  "originKey" TEXT NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "radiusMeters" BIGINT,
  "routeCode" TEXT NOT NULL,
  constraint origin_pkey primary key ("originKey", "routeCode")
);

-- Enable RLS
ALTER TABLE public.origin ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read on origin" ON public.origin;
DROP POLICY IF EXISTS "Allow service insert on origin" ON public.origin;
DROP POLICY IF EXISTS "Allow service update on origin" ON public.origin;
DROP POLICY IF EXISTS "Allow service delete on origin" ON public.origin;

-- Create policies
CREATE POLICY "Allow public read on origin" ON public.origin FOR SELECT USING (true);
CREATE POLICY "Allow service insert on origin" ON public.origin FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on origin" ON public.origin FOR UPDATE USING (true);
CREATE POLICY "Allow service delete on origin" ON public.origin FOR DELETE USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS idx_origin_name ON public.origin(name);

-- =====================================================
-- TABLE: customer
-- =====================================================
CREATE TABLE IF NOT EXISTS public.customer (
  "stationKey" TEXT NOT NULL,
  "stationKey2" TEXT NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "radiusMeters" BIGINT,
  email TEXT,
  "STD" TEXT,
  constraint customer_pkey primary key ("stationKey")
);

-- Enable RLS
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read on customer" ON public.customer;
DROP POLICY IF EXISTS "Allow service insert on customer" ON public.customer;
DROP POLICY IF EXISTS "Allow service update on customer" ON public.customer;
DROP POLICY IF EXISTS "Allow service delete on customer" ON public.customer;

-- Create policies
CREATE POLICY "Allow public read on customer" ON public.customer FOR SELECT USING (true);
CREATE POLICY "Allow service insert on customer" ON public.customer FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on customer" ON public.customer FOR UPDATE USING (true);
CREATE POLICY "Allow service delete on customer" ON public.customer FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_station_key2 ON public.customer("stationKey2");
CREATE INDEX IF NOT EXISTS idx_customer_name ON public.customer(name);
CREATE INDEX IF NOT EXISTS idx_customer_email ON public.customer(email);
CREATE INDEX IF NOT EXISTS idx_customer_std ON public.customer("STD");

-- =====================================================
-- INSERT DEFAULT ORIGIN DATA
-- =====================================================
INSERT INTO public.origin ("originKey", name, lat, lng, "radiusMeters", "routeCode")
VALUES
  ('TOP_SR', 'ไทยออยล์ ศรีราชา', 13.1100258, 100.9144418, 500, '001'),
  ('TOP_LC', 'ไทยออยล์ แหลมฉบัง', 13.0850000, 100.8950000, 500, '002')
ON CONFLICT ("originKey", "routeCode") DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  "radiusMeters" = EXCLUDED."radiusMeters";

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

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
