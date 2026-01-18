-- =====================================================
-- TEST: jobdata_grouped view and update functions
-- =====================================================

-- =====================================================
-- STEP 1: Insert test data (แยกรายแถว)
-- =====================================================
TRUNCATE TABLE jobdata CASCADE;

INSERT INTO jobdata (
  reference, seq, shipment_no, ship_to_code, ship_to_name,
  status, dest_lat, dest_lng, radius_m,
  vehicle_desc, drivers, route,
  materials, total_qty, is_origin_stop,
  created_at, updated_at
) VALUES
  -- Reference 2601M01559 - Ship to 11000973 (2 แถว - จุดเดียวกัน)
  ('2601M01559', 1, '6100555337', '11000973', 'บริษัท คู่บุญ ทวีกาญจน์ จำกัด',
   'pending', 14.3595579, 100.8792244, 200,
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08215',
   'PT MAX GASOHOL 95', 3.00, false,
   NOW(), NOW()),
   
  ('2601M01559', 2, '6100555337', '11000973', 'บริษัท คู่บุญ ทวีกาญจน์ จำกัด',
   'pending', 14.3595579, 100.8792244, 200,
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08215',
   'PT MAX DIESEL', 8.00, false,
   NOW(), NOW()),
   
  -- Reference 2601M01559 - Ship to ZSF76 (2 แถว - จุดเดียวกัน)
  ('2601M01559', 3, '6301158878', 'ZSF76', 'PTC-STA-นครหลวง3',
   'pending', 14.4577900, 100.6251100, 200,
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08A54',
   'PT MAX GASOHOL 95', 3.00, true,
   NOW(), NOW()),
   
  ('2601M01559', 4, '6301158878', 'ZSF76', 'PTC-STA-นครหลวง3',
   'pending', 14.4577900, 100.6251100, 200,
   'PTGLG-W0249(NK)/FVM/กท79-9964', 'นายสุรศักดิ์ สระรัมย์', 'Z08A54',
   'PT MAX DIESEL', 4.00, true,
   NOW(), NOW());

-- ตรวจสอบข้อมูลดิบ (4 แถว)
SELECT 
  id,
  reference,
  seq,
  ship_to_code,
  ship_to_name,
  materials,
  total_qty,
  status
FROM jobdata
ORDER BY seq;

-- =====================================================
-- STEP 2: Query jobdata_grouped view (แสดงแบบรวม)
-- =====================================================
-- ควรได้ 2 แถว (รวมจุดที่ซ้ำกัน)
SELECT 
  group_id,
  reference,
  seq,
  ship_to_code,
  ship_to_name,
  materials,
  total_qty,
  item_count,
  item_ids,
  status,
  checkin_time,
  checkout_time,
  vehicle_desc,
  drivers
FROM jobdata_grouped
WHERE reference = '2601M01559'
ORDER BY seq;

-- Expected result:
-- group_id              | reference  | seq | ship_to_code | materials                          | total_qty | item_count | item_ids
-- ----------------------|------------|-----|--------------|-------------------------------------|-----------|------------|----------
-- 2601M01559_11000973   | 2601M01559 | 1   | 11000973     | PT MAX DIESEL, PT MAX GASOHOL 95   | 11.00     | 2          | {1,2}
-- 2601M01559_ZSF76      | 2601M01559 | 3   | ZSF76        | PT MAX DIESEL, PT MAX GASOHOL 95   | 7.00      | 2          | {3,4}

-- =====================================================
-- STEP 3: Test check-in update
-- =====================================================
-- Check-in ที่จุด 11000973
SELECT * FROM update_grouped_stop_checkin(
  '2601M01559',                    -- reference
  '11000973',                       -- ship_to_code
  '2026-01-17 08:30:00+07'::TIMESTAMPTZ, -- checkin_time
  14.3595500,                       -- checkin_lat
  100.8792200,                      -- checkin_lng
  12500,                            -- checkin_odo
  15.5,                             -- accuracy
  'U001'                            -- updated_by
);

-- Expected: updated_count = 2, updated_ids = {1,2}

-- ตรวจสอบว่าทั้ง 2 แถวถูก update
SELECT 
  id,
  reference,
  seq,
  ship_to_code,
  status,
  checkin_time,
  checkin_lat,
  checkin_lng,
  checkin_odo,
  updated_by
FROM jobdata
WHERE reference = '2601M01559'
  AND ship_to_code = '11000973'
ORDER BY seq;

-- Expected: ทั้ง 2 แถว (id=1,2) มี status='checkin' และมีข้อมูล checkin

-- =====================================================
-- STEP 4: Test check-out update
-- =====================================================
-- Check-out ที่จุด 11000973
SELECT * FROM update_grouped_stop_checkout(
  '2601M01559',                    -- reference
  '11000973',                       -- ship_to_code
  '2026-01-17 09:15:00+07'::TIMESTAMPTZ, -- checkout_time
  14.3595600,                       -- checkout_lat
  100.8792300,                      -- checkout_lng
  12550,                            -- checkout_odo
  'นายสมชาย',                      -- receiver_name
  'พนักงาน',                       -- receiver_type
  'U001'                            -- updated_by
);

-- Expected: updated_count = 2, updated_ids = {1,2}

-- ตรวจสอบว่าทั้ง 2 แถวถูก update
SELECT 
  id,
  reference,
  seq,
  ship_to_code,
  status,
  checkout_time,
  checkout_lat,
  checkout_lng,
  checkout_odo,
  receiver_name
FROM jobdata
WHERE reference = '2601M01559'
  AND ship_to_code = '11000973'
ORDER BY seq;

-- =====================================================
-- STEP 5: Verify grouped view shows updated data
-- =====================================================
SELECT 
  group_id,
  reference,
  seq,
  ship_to_code,
  status,
  checkin_time,
  checkout_time,
  item_count,
  item_ids
FROM jobdata_grouped
WHERE reference = '2601M01559'
ORDER BY seq;

-- Expected:
-- group_id            | status   | checkin_time        | checkout_time       | item_count
-- --------------------|----------|---------------------|---------------------|------------
-- 2601M01559_11000973 | checkout | 2026-01-17 08:30:00 | 2026-01-17 09:15:00 | 2
-- 2601M01559_ZSF76    | pending  | null                | null                | 2

-- =====================================================
-- STEP 6: Test fueling update
-- =====================================================
SELECT * FROM update_grouped_stop_fueling(
  '2601M01559',
  'ZSF76',
  '2026-01-17 10:00:00+07'::TIMESTAMPTZ,
  'U001'
);

-- ตรวจสอบ
SELECT 
  id, ship_to_code, fueling_time, updated_by
FROM jobdata
WHERE reference = '2601M01559' AND ship_to_code = 'ZSF76'
ORDER BY seq;

-- =====================================================
-- STEP 7: Test unload update
-- =====================================================
SELECT * FROM update_grouped_stop_unload(
  '2601M01559',
  'ZSF76',
  '2026-01-17 10:30:00+07'::TIMESTAMPTZ,
  'U001'
);

-- ตรวจสอบ
SELECT 
  id, ship_to_code, unload_done_time, updated_by
FROM jobdata
WHERE reference = '2601M01559' AND ship_to_code = 'ZSF76'
ORDER BY seq;

-- =====================================================
-- STEP 8: Compare raw vs grouped
-- =====================================================
-- Raw data (4 rows)
SELECT 
  'RAW' AS source,
  id,
  seq,
  ship_to_code,
  materials,
  total_qty,
  status,
  checkin_time,
  checkout_time
FROM jobdata
WHERE reference = '2601M01559'
ORDER BY seq;

-- Grouped data (2 rows)
SELECT 
  'GROUPED' AS source,
  NULL::INTEGER AS id,
  seq,
  ship_to_code,
  materials,
  total_qty,
  status,
  checkin_time,
  checkout_time
FROM jobdata_grouped
WHERE reference = '2601M01559'
ORDER BY seq;

-- =====================================================
-- CLEANUP
-- =====================================================
/*
DELETE FROM jobdata WHERE reference = '2601M01559';
*/

-- =====================================================
-- Summary of Expected Results
-- =====================================================
/*
✅ STEP 1: Insert 4 rows in jobdata
✅ STEP 2: View shows 2 grouped rows (materials combined, qty summed)
✅ STEP 3: Check-in updates 2 rows (id=1,2) at once
✅ STEP 4: Check-out updates 2 rows (id=1,2) at once
✅ STEP 5: View reflects updated status='checkout'
✅ STEP 6: Fueling updates 2 rows (id=3,4)
✅ STEP 7: Unload updates 2 rows (id=3,4)
✅ STEP 8: Raw shows 4 rows, Grouped shows 2 rows

Key Points:
- Database: 4 rows (แยกรายแถว)
- Frontend: 2 rows (รวมตาม ship_to_code)
- Update: บันทึกลงทุกแถวที่ ship_to_code เดียวกัน
*/
