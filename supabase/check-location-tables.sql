-- ตรวจสอบโครงสร้างตาราง origin, customer, station ใน Supabase
-- เพื่อให้แน่ใจว่าโค้ดใช้ column names ที่ถูกต้อง

-- ตรวจสอบตาราง origin
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'origin'
ORDER BY ordinal_position;

-- ตรวจสอบตาราง customer
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'customer'
ORDER BY ordinal_position;

-- ตรวจสอบตาราง station
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'station'
ORDER BY ordinal_position;

-- ดูตัวอย่างข้อมูลจากแต่ละตาราง
SELECT * FROM public.origin LIMIT 5;
SELECT * FROM public.customer LIMIT 5;
SELECT * FROM public.station LIMIT 5;
