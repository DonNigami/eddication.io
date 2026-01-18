-- =====================================================
-- SOLUTION: Frontend Grouped Display + Backend Multi-row Update
-- =====================================================
-- Database: เก็บข้อมูลแยกรายแถวเหมือนเดิม (ไม่ merge)
-- Frontend: แสดงแบบรวมจุดที่ซ้ำกัน
-- Update: บันทึกลงทุกแถวที่มี ship_to_code เดียวกัน
-- =====================================================

-- =====================================================
-- VIEW: jobdata_grouped
-- รวมจุดที่ซ้ำกันสำหรับแสดงใน Frontend
-- =====================================================
CREATE OR REPLACE VIEW jobdata_grouped AS
SELECT 
  -- Primary key (composite: reference + ship_to_code)
  reference || '_' || ship_to_code AS group_id,
  
  -- Group identifiers
  reference,
  ship_to_code,
  ship_to_name,
  
  -- Aggregated data
  STRING_AGG(DISTINCT materials, ', ' ORDER BY materials) 
    FILTER (WHERE materials IS NOT NULL) AS materials,
  SUM(total_qty) AS total_qty,
  
  -- Count of items in this group
  COUNT(*) AS item_count,
  
  -- Array of all IDs in this group (สำหรับ update ทีหลัง)
  ARRAY_AGG(id ORDER BY seq) AS item_ids,
  
  -- First row data (coordinates, vehicle, etc.)
  (ARRAY_AGG(dest_lat ORDER BY seq))[1] AS dest_lat,
  (ARRAY_AGG(dest_lng ORDER BY seq))[1] AS dest_lng,
  (ARRAY_AGG(radius_m ORDER BY seq))[1] AS radius_m,
  (ARRAY_AGG(vehicle_desc ORDER BY seq))[1] AS vehicle_desc,
  (ARRAY_AGG(drivers ORDER BY seq))[1] AS drivers,
  (ARRAY_AGG(route ORDER BY seq))[1] AS route,
  (ARRAY_AGG(shipment_no ORDER BY seq))[1] AS shipment_no,
  
  -- Minimum seq (for ordering)
  MIN(seq) AS seq,
  
  -- Status: ใช้สถานะที่ "ก้าวหน้าที่สุด"
  -- pending < checkin < checkout
  CASE 
    WHEN BOOL_OR(status = 'checkout') THEN 'checkout'
    WHEN BOOL_OR(status = 'checkin') THEN 'checkin'
    ELSE 'pending'
  END AS status,
  
  -- Check-in: ใช้ค่าจากแถวแรกที่มีข้อมูล
  (ARRAY_AGG(checkin_time ORDER BY checkin_time NULLS LAST))[1] AS checkin_time,
  (ARRAY_AGG(checkin_lat ORDER BY checkin_time NULLS LAST))[1] AS checkin_lat,
  (ARRAY_AGG(checkin_lng ORDER BY checkin_time NULLS LAST))[1] AS checkin_lng,
  (ARRAY_AGG(checkin_odo ORDER BY checkin_time NULLS LAST))[1] AS checkin_odo,
  
  -- Fueling: ใช้ค่าจากแถวแรกที่มีข้อมูล
  (ARRAY_AGG(fueling_time ORDER BY fueling_time NULLS LAST))[1] AS fueling_time,
  
  -- Unload: ใช้ค่าจากแถวแรกที่มีข้อมูล
  (ARRAY_AGG(unload_done_time ORDER BY unload_done_time NULLS LAST))[1] AS unload_done_time,
  
  -- Check-out: ใช้ค่าจากแถวแรกที่มีข้อมูล
  (ARRAY_AGG(checkout_time ORDER BY checkout_time NULLS LAST))[1] AS checkout_time,
  (ARRAY_AGG(checkout_lat ORDER BY checkout_time NULLS LAST))[1] AS checkout_lat,
  (ARRAY_AGG(checkout_lng ORDER BY checkout_time NULLS LAST))[1] AS checkout_lng,
  
  -- Metadata
  BOOL_OR(is_origin_stop) AS is_origin_stop,
  BOOL_OR(has_pumping) AS has_pumping,
  BOOL_OR(has_transfer) AS has_transfer,
  
  -- Timestamps
  MIN(created_at) AS created_at,
  MAX(updated_at) AS updated_at

FROM jobdata
WHERE ship_to_code IS NOT NULL 
  AND ship_to_code != ''
GROUP BY reference, ship_to_code, ship_to_name
ORDER BY reference, MIN(seq);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_jobdata_reference_shiptocode 
  ON jobdata(reference, ship_to_code);

-- =====================================================
-- FUNCTION: update_grouped_stop_checkin
-- บันทึก check-in ลงทุกแถวที่มี ship_to_code เดียวกัน
-- =====================================================
CREATE OR REPLACE FUNCTION update_grouped_stop_checkin(
  p_reference TEXT,
  p_ship_to_code TEXT,
  p_checkin_time TIMESTAMPTZ,
  p_checkin_lat DECIMAL,
  p_checkin_lng DECIMAL,
  p_checkin_odo INTEGER DEFAULT NULL,
  p_accuracy DECIMAL DEFAULT NULL,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS TABLE(
  updated_count INTEGER,
  updated_ids INTEGER[],
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_updated_ids INTEGER[];
BEGIN
  -- Update all rows with matching reference + ship_to_code
  WITH updated AS (
    UPDATE jobdata
    SET 
      status = 'checkin',
      checkin_time = p_checkin_time,
      checkin_lat = p_checkin_lat,
      checkin_lng = p_checkin_lng,
      checkin_odo = COALESCE(p_checkin_odo, checkin_odo),
      accuracy = COALESCE(p_accuracy, accuracy),
      updated_by = COALESCE(p_updated_by, updated_by),
      updated_at = NOW()
    WHERE reference = p_reference
      AND ship_to_code = p_ship_to_code
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_updated_count, v_updated_ids
  FROM updated;
  
  RETURN QUERY SELECT 
    v_updated_count,
    v_updated_ids,
    format('Updated %s row(s) for %s - %s', v_updated_count, p_reference, p_ship_to_code);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: update_grouped_stop_checkout
-- บันทึก check-out ลงทุกแถวที่มี ship_to_code เดียวกัน
-- =====================================================
CREATE OR REPLACE FUNCTION update_grouped_stop_checkout(
  p_reference TEXT,
  p_ship_to_code TEXT,
  p_checkout_time TIMESTAMPTZ,
  p_checkout_lat DECIMAL,
  p_checkout_lng DECIMAL,
  p_checkout_odo INTEGER DEFAULT NULL,
  p_receiver_name TEXT DEFAULT NULL,
  p_receiver_type TEXT DEFAULT NULL,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS TABLE(
  updated_count INTEGER,
  updated_ids INTEGER[],
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_updated_ids INTEGER[];
BEGIN
  -- Update all rows with matching reference + ship_to_code
  WITH updated AS (
    UPDATE jobdata
    SET 
      status = 'checkout',
      checkout_time = p_checkout_time,
      checkout_lat = p_checkout_lat,
      checkout_lng = p_checkout_lng,
      checkout_odo = COALESCE(p_checkout_odo, checkout_odo),
      receiver_name = COALESCE(p_receiver_name, receiver_name),
      receiver_type = COALESCE(p_receiver_type, receiver_type),
      updated_by = COALESCE(p_updated_by, updated_by),
      updated_at = NOW()
    WHERE reference = p_reference
      AND ship_to_code = p_ship_to_code
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_updated_count, v_updated_ids
  FROM updated;
  
  RETURN QUERY SELECT 
    v_updated_count,
    v_updated_ids,
    format('Updated %s row(s) for %s - %s', v_updated_count, p_reference, p_ship_to_code);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: update_grouped_stop_fueling
-- บันทึก fueling ลงทุกแถวที่มี ship_to_code เดียวกัน
-- =====================================================
CREATE OR REPLACE FUNCTION update_grouped_stop_fueling(
  p_reference TEXT,
  p_ship_to_code TEXT,
  p_fueling_time TIMESTAMPTZ,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS TABLE(
  updated_count INTEGER,
  updated_ids INTEGER[],
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_updated_ids INTEGER[];
BEGIN
  WITH updated AS (
    UPDATE jobdata
    SET 
      fueling_time = p_fueling_time,
      updated_by = COALESCE(p_updated_by, updated_by),
      updated_at = NOW()
    WHERE reference = p_reference
      AND ship_to_code = p_ship_to_code
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_updated_count, v_updated_ids
  FROM updated;
  
  RETURN QUERY SELECT 
    v_updated_count,
    v_updated_ids,
    format('Updated %s row(s) for %s - %s', v_updated_count, p_reference, p_ship_to_code);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: update_grouped_stop_unload
-- บันทึก unload ลงทุกแถวที่มี ship_to_code เดียวกัน
-- =====================================================
CREATE OR REPLACE FUNCTION update_grouped_stop_unload(
  p_reference TEXT,
  p_ship_to_code TEXT,
  p_unload_done_time TIMESTAMPTZ,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS TABLE(
  updated_count INTEGER,
  updated_ids INTEGER[],
  message TEXT
) AS $$
DECLARE
  v_updated_count INTEGER;
  v_updated_ids INTEGER[];
BEGIN
  WITH updated AS (
    UPDATE jobdata
    SET 
      unload_done_time = p_unload_done_time,
      updated_by = COALESCE(p_updated_by, updated_by),
      updated_at = NOW()
    WHERE reference = p_reference
      AND ship_to_code = p_ship_to_code
    RETURNING id
  )
  SELECT 
    COUNT(*)::INTEGER,
    ARRAY_AGG(id)
  INTO v_updated_count, v_updated_ids
  FROM updated;
  
  RETURN QUERY SELECT 
    v_updated_count,
    v_updated_ids,
    format('Updated %s row(s) for %s - %s', v_updated_count, p_reference, p_ship_to_code);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON VIEW jobdata_grouped IS 
  'Grouped view of jobdata for frontend display. Merges items with same ship_to_code.';

COMMENT ON FUNCTION update_grouped_stop_checkin IS 
  'Update check-in for all jobdata rows with matching reference + ship_to_code';

COMMENT ON FUNCTION update_grouped_stop_checkout IS 
  'Update check-out for all jobdata rows with matching reference + ship_to_code';

COMMENT ON FUNCTION update_grouped_stop_fueling IS 
  'Update fueling time for all jobdata rows with matching reference + ship_to_code';

COMMENT ON FUNCTION update_grouped_stop_unload IS 
  'Update unload time for all jobdata rows with matching reference + ship_to_code';
