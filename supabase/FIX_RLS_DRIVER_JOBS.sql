-- ตรวจสอบและแก้ไข RLS Policies สำหรับ driver_jobs
-- Run this SQL in Supabase SQL Editor

-- ============================================
-- 1. ตรวจสอบ RLS Status
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'driver_jobs';

-- ============================================
-- 2. ตรวจสอบ Policies ที่มีอยู่
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'driver_jobs'
ORDER BY policyname;

-- ============================================
-- 3. ลบ Policies เก่าทั้งหมด
-- ============================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT schemaname, policyname 
        FROM pg_policies 
        WHERE tablename = 'driver_jobs'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.driver_jobs', r.policyname, r.schemaname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- ============================================
-- 4. สร้าง Policies ใหม่ (Allow All)
-- ============================================

-- ปิด RLS ชั่วคราว (ถ้าต้องการ)
-- ALTER TABLE driver_jobs DISABLE ROW LEVEL SECURITY;

-- หรือเปิด RLS และสร้าง policies ที่ถูกต้อง
ALTER TABLE driver_jobs ENABLE ROW LEVEL SECURITY;

-- Policy สำหรับ SELECT (สำคัญมาก!)
CREATE POLICY "anon_can_select_driver_jobs"
  ON driver_jobs
  FOR SELECT
  TO anon, authenticated, public
  USING (true);

-- Policy สำหรับ INSERT
CREATE POLICY "anon_can_insert_driver_jobs"
  ON driver_jobs
  FOR INSERT
  TO anon, authenticated, public
  WITH CHECK (true);

-- Policy สำหรับ UPDATE
CREATE POLICY "anon_can_update_driver_jobs"
  ON driver_jobs
  FOR UPDATE
  TO anon, authenticated, public
  USING (true)
  WITH CHECK (true);

-- Policy สำหรับ DELETE
CREATE POLICY "anon_can_delete_driver_jobs"
  ON driver_jobs
  FOR DELETE
  TO anon, authenticated, public
  USING (true);

-- ============================================
-- 5. ตรวจสอบ Policies ใหม่
-- ============================================
SELECT 
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN qual::text = 'true' THEN '✅ Allow All'
    ELSE qual::text
  END as condition
FROM pg_policies 
WHERE tablename = 'driver_jobs'
ORDER BY cmd, policyname;

-- ============================================
-- 6. ทดสอบ Query
-- ============================================
SELECT 
  '✅ Query Test' as status,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN reference = '2601M01559' THEN 1 END) as test_reference_found
FROM driver_jobs;

-- ============================================
-- 7. แสดงข้อมูลทดสอบ
-- ============================================
SELECT 
  id,
  reference,
  vehicle_desc,
  drivers,
  status,
  created_at
FROM driver_jobs
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- SUCCESS
-- ============================================
SELECT '✅ RLS Policies fixed! Error 406 should be resolved now.' as result;
