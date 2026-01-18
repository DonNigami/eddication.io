-- =====================================================
-- TEST SCRIPT: Merge driver_jobs to jobdata
-- =====================================================
-- สคริปต์นี้ใช้ทดสอบการทำงานของ merge functions
-- =====================================================

-- =====================================================
-- STEP 1: Insert test data into driver_jobs
-- =====================================================
INSERT INTO driver_jobs (
  reference,
  shipment_no,
  ship_to,
  ship_to_name,
  ship_to_address,
  material_desc,
  delivery_qty,
  delivery_uom,
  vehicle_desc,
  drivers,
  route,
  shipment_item,
  dest_lat,
  dest_lng,
  status
) VALUES
  -- Reference 2601M01559 - Ship to 11000973 (2 items)
  ('2601M01559', '6100555337', '11000973', 'บริษัท คู่บุญ ทวีกาญจน์ จำกัด', 
   '123 ถนนพระราม กรุงเทพฯ', 'PT MAX GASOHOL 95', 3.00, 'KL', 
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08215', '1',
   14.3595579, 100.8792244, 'pending'),
   
  ('2601M01559', '6100555337', '11000973', 'บริษัท คู่บุญ ทวีกาญจน์ จำกัด', 
   '123 ถนนพระราม กรุงเทพฯ', 'PT MAX DIESEL', 8.00, 'KL', 
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08215', '2',
   14.3595579, 100.8792244, 'pending'),
   
  -- Reference 2601M01559 - Ship to ZSF76 (2 items)
  ('2601M01559', '6301158878', 'ZSF76', 'PTC-STA-นครหลวง3', 
   'นครหลวง จ.พระนครศรีอยุธยา', 'PT MAX GASOHOL 95', 3.00, 'KL', 
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08A54', '3',
   14.4577900, 100.6251100, 'pending'),
   
  ('2601M01559', '6301158878', 'ZSF76', 'PTC-STA-นครหลวง3', 
   'นครหลวง จ.พระนครศรีอยุธยา', 'PT MAX DIESEL', 4.00, 'KL', 
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08A54', '4',
   14.4577900, 100.6251100, 'pending')
ON CONFLICT (reference, shipment_item) DO UPDATE SET
  ship_to_name = EXCLUDED.ship_to_name,
  material_desc = EXCLUDED.material_desc,
  delivery_qty = EXCLUDED.delivery_qty,
  updated_at = NOW();

-- ตรวจสอบข้อมูลที่เพิ่ม
SELECT 
  reference,
  shipment_no,
  ship_to,
  ship_to_name,
  material_desc,
  delivery_qty,
  shipment_item
FROM driver_jobs
WHERE reference = '2601M01559'
ORDER BY shipment_item::INTEGER;

-- =====================================================
-- STEP 2: Preview merge result (ไม่บันทึกข้อมูล)
-- =====================================================
-- ดูว่าข้อมูลจะถูกรวมอย่างไร
SELECT 
  dj.reference,
  dj.shipment_no,
  dj.ship_to AS ship_to_code,
  dj.ship_to_name,
  dj.vehicle_desc,
  dj.drivers,
  dj.route,
  -- รวม materials
  STRING_AGG(DISTINCT dj.material_desc, ', ' ORDER BY dj.material_desc) AS materials,
  -- รวม total_qty
  SUM(dj.delivery_qty) AS total_qty,
  -- นับจำนวน items
  COUNT(*) AS item_count,
  -- seq
  MIN(dj.shipment_item::INTEGER) AS seq
FROM driver_jobs dj
WHERE dj.reference = '2601M01559'
  AND dj.ship_to IS NOT NULL
  AND dj.ship_to != ''
GROUP BY 
  dj.reference,
  dj.shipment_no,
  dj.ship_to,
  dj.ship_to_name,
  dj.vehicle_desc,
  dj.drivers,
  dj.route
ORDER BY MIN(dj.shipment_item::INTEGER);

-- =====================================================
-- STEP 3: Run merge function
-- =====================================================
-- รัน merge สำหรับ reference นี้
SELECT * FROM merge_driver_jobs_to_jobdata('2601M01559');

-- =====================================================
-- STEP 4: Verify results
-- =====================================================
-- ตรวจสอบผลลัพธ์ใน jobdata
SELECT 
  id,
  reference,
  shipment_no,
  ship_to_code,
  ship_to_name,
  status,
  seq,
  route,
  drivers,
  materials,
  total_qty,
  is_origin_stop,
  dest_lat,
  dest_lng,
  created_at,
  updated_at
FROM jobdata
WHERE reference = '2601M01559'
ORDER BY seq;

-- =====================================================
-- STEP 5: Compare counts
-- =====================================================
-- เปรียบเทียบจำนวนแถว
SELECT 
  'driver_jobs' AS source,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT ship_to) AS unique_stops
FROM driver_jobs
WHERE reference = '2601M01559'
UNION ALL
SELECT 
  'jobdata' AS source,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT ship_to_code) AS unique_stops
FROM jobdata
WHERE reference = '2601M01559';

-- =====================================================
-- STEP 6: Test upsert (update existing)
-- =====================================================
-- ลองรัน merge อีกครั้ง (ควร update ข้อมูลเดิม)
SELECT * FROM merge_driver_jobs_to_jobdata('2601M01559');

-- ตรวจสอบว่า updated_at เปลี่ยนแปลง
SELECT 
  id,
  reference,
  ship_to_code,
  materials,
  total_qty,
  created_at,
  updated_at
FROM jobdata
WHERE reference = '2601M01559'
ORDER BY seq;

-- =====================================================
-- STEP 7: Test sync all
-- =====================================================
-- รัน sync ทั้งหมด
SELECT * FROM sync_all_driver_jobs_to_jobdata();

-- =====================================================
-- CLEANUP (ถ้าต้องการลบข้อมูลทดสอบ)
-- =====================================================
/*
DELETE FROM jobdata WHERE reference = '2601M01559';
DELETE FROM driver_jobs WHERE reference = '2601M01559';
*/

-- =====================================================
-- Expected Results
-- =====================================================
/*
Step 1: Should insert 4 rows in driver_jobs

Step 2: Preview should show 2 grouped rows:
  - ship_to_code: 11000973, materials: PT MAX DIESEL, PT MAX GASOHOL 95, total_qty: 11.00
  - ship_to_code: ZSF76, materials: PT MAX DIESEL, PT MAX GASOHOL 95, total_qty: 7.00

Step 3: merge_driver_jobs_to_jobdata should return:
  - inserted_count: 2
  - merged_count: 2
  - message: Inserted 2 new stops, merged 2 duplicate items

Step 4: jobdata should have 2 rows:
  id | reference  | ship_to_code | materials                          | total_qty | seq
  ---|------------|--------------|-------------------------------------|-----------|----
  9  | 2601M01559 | 11000973     | PT MAX DIESEL, PT MAX GASOHOL 95   | 11.00     | 1
  10 | 2601M01559 | ZSF76        | PT MAX DIESEL, PT MAX GASOHOL 95   | 7.00      | 3

Step 5: Should show:
  source      | total_rows | unique_stops
  ------------|------------|-------------
  driver_jobs | 4          | 2
  jobdata     | 2          | 2

Step 6: Second merge should update existing records (inserted_count: 0, merged_count: 2)

Step 7: sync_all should process all references in driver_jobs
*/
