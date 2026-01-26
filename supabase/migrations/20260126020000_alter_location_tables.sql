-- =====================================================
-- ALTER EXISTING LOCATION TABLES
-- =====================================================
-- This migration ensures the location tables match the schema
-- expected by the client code and Edge Functions.
--
-- Key columns for station table: stationKey, name, lat, lng, radiusMeters
-- Key columns for customer table: stationKey, name, lat, lng, radiusMeters
-- Key columns for origin table: originKey, name, lat, lng, radiusMeters, routeCode
-- =====================================================

-- =====================================================
-- TABLE: station - ensure correct schema
-- =====================================================

-- Drop existing table if schema is incompatible
DROP TABLE IF EXISTS public.station CASCADE;

-- Create station with correct structure (camelCase to match code)
CREATE TABLE IF NOT EXISTS public.station (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stationKey TEXT UNIQUE NOT NULL,
  name TEXT,
  lat TEXT,
  lng TEXT,
  radiusMeters INTEGER DEFAULT 100,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_station_station_key ON public.station(stationKey);
CREATE INDEX IF NOT EXISTS idx_station_name ON public.station(name);

-- Enable RLS
ALTER TABLE public.station ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
DROP POLICY IF EXISTS "Allow public read on station" ON public.station;
CREATE POLICY "Allow public read on station" ON public.station FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service insert on station" ON public.station;
CREATE POLICY "Allow service insert on station" ON public.station FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service update on station" ON public.station;
CREATE POLICY "Allow service update on station" ON public.station FOR UPDATE USING (true);

-- =====================================================
-- TABLE: customer - ensure correct schema
-- =====================================================

-- Drop existing table if schema is incompatible
DROP TABLE IF EXISTS public.customer CASCADE;

-- Create customer with correct structure (camelCase to match code)
CREATE TABLE IF NOT EXISTS public.customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stationKey TEXT UNIQUE NOT NULL,
  name TEXT,
  lat TEXT,
  lng TEXT,
  radiusMeters INTEGER DEFAULT 100,
  source TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_station_key ON public.customer(stationKey);
CREATE INDEX IF NOT EXISTS idx_customer_name ON public.customer(name);

-- Enable RLS
ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
DROP POLICY IF EXISTS "Allow public read on customer" ON public.customer;
CREATE POLICY "Allow public read on customer" ON public.customer FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service insert on customer" ON public.customer;
CREATE POLICY "Allow service insert on customer" ON public.customer FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service update on customer" ON public.customer;
CREATE POLICY "Allow service update on customer" ON public.customer FOR UPDATE USING (true);

-- =====================================================
-- TABLE: origin - ensure correct schema
-- =====================================================

-- Drop existing table if schema is incompatible
DROP TABLE IF EXISTS public.origin CASCADE;

-- Create origin with correct structure (camelCase to match code)
CREATE TABLE IF NOT EXISTS public.origin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  originKey TEXT UNIQUE NOT NULL,
  name TEXT,
  lat TEXT,
  lng TEXT,
  radiusMeters INTEGER DEFAULT 200,
  routeCode TEXT,
  active BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_origin_origin_key ON public.origin(originKey);
CREATE INDEX IF NOT EXISTS idx_origin_route_code ON public.origin(routeCode);
CREATE INDEX IF NOT EXISTS idx_origin_active ON public.origin(active);

-- Enable RLS
ALTER TABLE public.origin ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
DROP POLICY IF EXISTS "Allow public read on origin" ON public.origin;
CREATE POLICY "Allow public read on origin" ON public.origin FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service insert on origin" ON public.origin;
CREATE POLICY "Allow service insert on origin" ON public.origin FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service update on origin" ON public.origin;
CREATE POLICY "Allow service update on origin" ON public.origin FOR UPDATE USING (true);

-- =====================================================
-- INSERT DEFAULT ORIGIN DATA
-- =====================================================
INSERT INTO public.origin (originKey, name, lat, lng, radiusMeters, routeCode, active)
VALUES
  ('TOP_SR', 'ไทยออยล์ ศรีราชา', '13.1100258', '100.9144418', 500, '001', true),
  ('TOP_LC', 'ไทยออยล์ แหลมฉบัง', '13.0850000', '100.8950000', 500, '002', true)
ON CONFLICT (originKey) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radiusMeters = EXCLUDED.radiusMeters,
  routeCode = EXCLUDED.routeCode,
  active = EXCLUDED.active;

-- =====================================================
-- INSERT SAMPLE STATION DATA
-- =====================================================
INSERT INTO public.station (stationKey, name, lat, lng, radiusMeters)
VALUES
  ('PTC-STA-ท่าทราย 2', 'ท่าทราย 2', '13.859400', '100.525300', 100),
  ('PTC-STA-ปากเกร็ด', 'ปากเกร็ด', '13.914600', '100.540700', 100)
ON CONFLICT (stationKey) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radiusMeters = EXCLUDED.radiusMeters;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Grant anon role access for driver app
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
