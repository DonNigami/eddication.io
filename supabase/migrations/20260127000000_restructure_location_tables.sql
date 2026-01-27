-- =====================================================
-- LOCATION TABLES RESTRUCTURE MIGRATION
-- Run this in Supabase Dashboard > SQL Editor:
-- https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql
-- =====================================================

-- =====================================================
-- DROP EXISTING TABLES IF THEY EXIST
-- =====================================================
DROP TABLE IF EXISTS public.customer CASCADE;
DROP TABLE IF EXISTS public.origin CASCADE;
DROP TABLE IF EXISTS public.station CASCADE;

-- =====================================================
-- TABLE: origin
-- Structure matches: DriverConnect - Origin.csv
-- Columns: originKey, name, lat, lng, radiusMeters, routeCode
-- =====================================================
CREATE TABLE IF NOT EXISTS public.origin (
  "originKey" TEXT NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "radiusMeters" BIGINT DEFAULT 300,
  "routeCode" TEXT NOT NULL,
  CONSTRAINT origin_pkey PRIMARY KEY ("originKey", "routeCode")
);

-- Enable RLS
ALTER TABLE public.origin ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read on origin" ON public.origin FOR SELECT USING (true);
CREATE POLICY "Allow service insert on origin" ON public.origin FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on origin" ON public.origin FOR UPDATE USING (true);
CREATE POLICY "Allow service delete on origin" ON public.origin FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_origin_name ON public.origin(name);
CREATE INDEX IF NOT EXISTS idx_origin_route_code ON public.origin("routeCode");

-- =====================================================
-- TABLE: customer
-- Structure matches: DriverConnect - Customer.csv
-- Columns: stationKey, stationKey2, name, lat, lng, radiusMeters, email, STD
-- =====================================================
CREATE TABLE IF NOT EXISTS public.customer (
  "stationKey" TEXT NOT NULL,
  "stationKey2" TEXT NOT NULL,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "radiusMeters" BIGINT DEFAULT 300,
  email TEXT,
  "STD" TEXT,
  CONSTRAINT customer_pkey PRIMARY KEY ("stationKey")
);

-- Enable RLS
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

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
-- TABLE: station
-- Structure matches: DriverConnect - STA_DATA.csv
-- Column Names:
--   ชื่อสถานีบริการ, Mobile, Name_Area, Phone_Area,
--   Name_Region, Phone_Region, GPS, ระยะเวลาเปิดให้บริการ,
--   Depot, plant code, lat, lng, stationKey
-- =====================================================
CREATE TABLE IF NOT EXISTS public.station (
  "ชื่อสถานีบริการ" TEXT,
  "Mobile" TEXT,
  "Name_Area" TEXT,
  "Phone_Area" TEXT,
  "Name_Region" TEXT,
  "Phone_Region" TEXT,
  "GPS" TEXT,
  "ระยะเวลาเปิดให้บริการ" TEXT,
  "Depot" TEXT,
  "plant code" TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  "stationKey" TEXT NOT NULL,
  CONSTRAINT station_pkey PRIMARY KEY ("plant code", "stationKey")
);

-- Enable RLS
ALTER TABLE public.station ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read on station" ON public.station FOR SELECT USING (true);
CREATE POLICY "Allow service insert on station" ON public.station FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update on station" ON public.station FOR UPDATE USING (true);
CREATE POLICY "Allow service delete on station" ON public.station FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_station_name_thai ON public.station("ชื่อสถานีบริการ");
CREATE INDEX IF NOT EXISTS idx_station_key ON public.station("stationKey");
CREATE INDEX IF NOT EXISTS idx_station_plant_code ON public.station("plant code");

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO anon;
GRANT UPDATE ON ALL TABLES IN SCHEMA public TO anon;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.origin IS 'Origin/Depot locations - matches DriverConnect - Origin.csv structure';
COMMENT ON TABLE public.customer IS 'Customer locations - matches DriverConnect - Customer.csv structure';
COMMENT ON TABLE public.station IS 'Service stations - matches DriverConnect - STA_DATA.csv structure (Thai column names)';
