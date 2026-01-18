-- =====================================================
-- MERGE driver_jobs TO jobdata
-- =====================================================
-- ฟังก์ชันนี้จะ:
-- 1. ดึงข้อมูลจาก driver_jobs
-- 2. รวมจุดที่ซ้ำกัน (ship_to_code เดียวกัน) ให้เป็น 1 แถว
-- 3. รวม materials และ total_qty
-- 4. บันทึกลง jobdata

-- =====================================================
-- Function: merge_driver_jobs_to_jobdata
-- =====================================================
CREATE OR REPLACE FUNCTION merge_driver_jobs_to_jobdata(p_reference TEXT)
RETURNS TABLE(
  inserted_count INTEGER,
  merged_count INTEGER,
  message TEXT
) AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_merged INTEGER := 0;
  v_job_data RECORD;
  v_stop_group RECORD;
  v_materials_text TEXT;
  v_total_qty NUMERIC;
  v_existing_id INTEGER;
BEGIN
  -- Loop through each unique (reference, ship_to, dest_lat, dest_lng) combination
  FOR v_stop_group IN
    SELECT 
      dj.reference,
      dj.shipment_no,
      dj.ship_to AS ship_to_code,
      dj.ship_to_name,
      dj.vehicle_desc,
      dj.drivers,
      dj.route,
      -- ใช้ค่าแรกสำหรับพิกัด (ถ้ามีหลายแถว ใช้แถวแรก)
      (ARRAY_AGG(dj.dest_lat ORDER BY dj.shipment_item))[1] AS dest_lat,
      (ARRAY_AGG(dj.dest_lng ORDER BY dj.shipment_item))[1] AS dest_lng,
      -- รวม materials (คั่นด้วย comma)
      STRING_AGG(DISTINCT dj.material_desc, ', ' ORDER BY dj.material_desc) AS materials,
      -- รวม total_qty
      SUM(dj.delivery_qty) AS total_qty,
      -- เก็บข้อมูลอื่นๆ จากแถวแรก
      (ARRAY_AGG(dj.ship_to_address ORDER BY dj.shipment_item))[1] AS ship_to_address,
      (ARRAY_AGG(dj.receiving_plant ORDER BY dj.shipment_item))[1] AS receiving_plant,
      -- นับจำนวนแถวที่ถูกรวม
      COUNT(*) AS item_count,
      -- seq (ใช้ค่าต่ำสุด)
      MIN(dj.shipment_item::INTEGER) AS min_seq,
      -- Check if origin stop
      BOOL_OR(dj.ship_to LIKE 'ZSF%' OR dj.ship_to_name LIKE '%PTC-STA-%') AS is_origin_stop
    FROM driver_jobs dj
    WHERE dj.reference = p_reference
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
    ORDER BY MIN(dj.shipment_item::INTEGER)
  LOOP
    -- เพิ่มการนับ merged items
    v_merged := v_merged + (v_stop_group.item_count - 1);
    
    -- ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
    SELECT id INTO v_existing_id
    FROM jobdata
    WHERE reference = v_stop_group.reference
      AND ship_to_code = v_stop_group.ship_to_code
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      -- อัพเดทข้อมูลที่มีอยู่
      UPDATE jobdata
      SET
        shipment_no = v_stop_group.shipment_no,
        ship_to_name = v_stop_group.ship_to_name,
        dest_lat = v_stop_group.dest_lat,
        dest_lng = v_stop_group.dest_lng,
        vehicle_desc = v_stop_group.vehicle_desc,
        drivers = v_stop_group.drivers,
        route = v_stop_group.route,
        materials = v_stop_group.materials,
        total_qty = v_stop_group.total_qty,
        is_origin_stop = v_stop_group.is_origin_stop,
        updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      -- เพิ่มข้อมูลใหม่
      INSERT INTO jobdata (
        reference,
        shipment_no,
        ship_to_code,
        ship_to_name,
        status,
        dest_lat,
        dest_lng,
        radius_m,
        vehicle_desc,
        drivers,
        route,
        seq,
        is_origin_stop,
        materials,
        total_qty,
        created_at,
        updated_at
      ) VALUES (
        v_stop_group.reference,
        v_stop_group.shipment_no,
        v_stop_group.ship_to_code,
        v_stop_group.ship_to_name,
        'pending',
        v_stop_group.dest_lat,
        v_stop_group.dest_lng,
        200,
        v_stop_group.vehicle_desc,
        v_stop_group.drivers,
        v_stop_group.route,
        v_stop_group.min_seq,
        v_stop_group.is_origin_stop,
        v_stop_group.materials,
        v_stop_group.total_qty,
        NOW(),
        NOW()
      );
      
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_inserted, 
    v_merged,
    format('Inserted %s new stops, merged %s duplicate items', v_inserted, v_merged);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function: sync_all_driver_jobs_to_jobdata
-- รวมข้อมูลทั้งหมดจาก driver_jobs ไป jobdata
-- =====================================================
CREATE OR REPLACE FUNCTION sync_all_driver_jobs_to_jobdata()
RETURNS TABLE(
  total_inserted INTEGER,
  total_merged INTEGER,
  references_processed INTEGER,
  message TEXT
) AS $$
DECLARE
  v_reference TEXT;
  v_result RECORD;
  v_total_inserted INTEGER := 0;
  v_total_merged INTEGER := 0;
  v_ref_count INTEGER := 0;
BEGIN
  -- Loop through all unique references in driver_jobs
  FOR v_reference IN
    SELECT DISTINCT reference
    FROM driver_jobs
    WHERE reference IS NOT NULL
    ORDER BY reference
  LOOP
    -- Call merge function for each reference
    FOR v_result IN
      SELECT * FROM merge_driver_jobs_to_jobdata(v_reference)
    LOOP
      v_total_inserted := v_total_inserted + v_result.inserted_count;
      v_total_merged := v_total_merged + v_result.merged_count;
      v_ref_count := v_ref_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_total_inserted,
    v_total_merged,
    v_ref_count,
    format('Processed %s references: %s stops inserted, %s items merged', 
      v_ref_count, v_total_inserted, v_total_merged);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- EXAMPLE USAGE
-- =====================================================
-- เรียกใช้สำหรับ reference เดียว:
-- SELECT * FROM merge_driver_jobs_to_jobdata('2601M01559');

-- เรียกใช้สำหรับทั้งหมด:
-- SELECT * FROM sync_all_driver_jobs_to_jobdata();

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON FUNCTION merge_driver_jobs_to_jobdata IS 
  'Merge driver_jobs data to jobdata table. Groups items by ship_to_code and combines materials.';

COMMENT ON FUNCTION sync_all_driver_jobs_to_jobdata IS 
  'Sync all driver_jobs data to jobdata table. Calls merge function for each reference.';
