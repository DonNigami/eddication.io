-- =====================================================
-- INSERT PTC STATION DATA
-- =====================================================
-- Run this in Supabase Dashboard > SQL Editor
-- https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new
-- =====================================================

-- Insert PTC stations with coordinates
INSERT INTO public.station (stationkey, name, lat, lng, radiusmeters)
VALUES
  ('PTC-STA-ท่าทราย 2', 'ท่าทราย 2', '13.9256', '100.7895', 100),
  ('PTC-STA-ปากเกร็ด', 'ปากเกร็ด', '13.9156', '100.5297', 100)
ON CONFLICT (stationkey) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  radiusmeters = EXCLUDED.radiusmeters;

-- Verify data
SELECT 'Station data:' as info;
SELECT stationkey, name, lat, lng, radiusmeters
FROM public.station
WHERE stationkey LIKE 'PTC%';
