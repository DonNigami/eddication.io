-- =====================================================
-- SUPABASE SCHEMA FOR DRIVER CONNECT APP (COMPLETE)
-- =====================================================
-- Run this SQL in Supabase SQL Editor to create all tables
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: jobdata (Main job/stops data)
-- =====================================================
-- ตรงกับ Google Sheets: jobdata (A-AE = 31 columns)
CREATE TABLE IF NOT EXISTS jobdata (
  id SERIAL PRIMARY KEY,

  -- A-D: ข้อมูลพื้นฐาน
  reference VARCHAR(50) NOT NULL,          -- A: referenceNo
  shipment_no VARCHAR(100),                 -- B: shipmentNo
  ship_to_code VARCHAR(50),                 -- C: shipToCode
  ship_to_name VARCHAR(200),                -- D: shipToName

  -- E: สถานะ
  status VARCHAR(30) DEFAULT 'PENDING',     -- E: status

  -- F-G: Check-in/out times
  checkin_time TIMESTAMPTZ,                 -- F: checkInTime
  checkout_time TIMESTAMPTZ,                -- G: checkOutTime

  -- H-K: Metadata
  updated_by VARCHAR(100),                  -- H: updatedBy
  source_row INTEGER,                       -- I: sourceRow (zoile row index)
  created_at TIMESTAMPTZ DEFAULT NOW(),     -- J: createdAt
  updated_at TIMESTAMPTZ DEFAULT NOW(),     -- K: updatedAt

  -- L-N: พิกัดปลายทาง
  dest_lat DECIMAL(10,7),                   -- L: destLat
  dest_lng DECIMAL(10,7),                   -- M: destLng
  radius_m INTEGER DEFAULT 200,             -- N: radiusM

  -- O-P: พิกัด Check-in
  checkin_lat DECIMAL(10,7),                -- O: checkinLat
  checkin_lng DECIMAL(10,7),                -- P: checkinLng

  -- Q-R: พิกัด Check-out
  checkout_lat DECIMAL(10,7),               -- Q: checkoutLat
  checkout_lng DECIMAL(10,7),               -- R: checkoutLng

  -- S-T: เวลาขั้นตอนต่างๆ
  fueling_time TIMESTAMPTZ,                 -- S: fuelingTime
  unload_done_time TIMESTAMPTZ,             -- T: unloadDoneTime

  -- U-V: Review และปิดงาน
  reviewed_time TIMESTAMPTZ,                -- U: reviewedTime
  job_closed_at TIMESTAMPTZ,                -- V: jobClosedAt

  -- W-X: Distance และ Odometer
  distance_km DECIMAL(10,2),                -- W: distanceKm
  checkin_odo INTEGER,                      -- X: checkinOdo (เลขไมล์ตอน Check-in)

  -- Y-AC: ข้อมูลจบทริป
  trip_end_odo INTEGER,                     -- Y: tripEndOdo
  trip_end_lat DECIMAL(10,7),               -- Z: tripEndLat
  trip_end_lng DECIMAL(10,7),               -- AA: tripEndLng
  trip_end_place VARCHAR(200),              -- AB: tripEndPlace
  trip_ended_at TIMESTAMPTZ,                -- AC: tripEndedAt

  -- AD-AE: ข้อมูลเพิ่มเติม
  vehicle_desc VARCHAR(200),                -- AD: vehicleDescription
  processdata_time TIMESTAMPTZ,             -- AE: processdataTime

  -- ============ คอลัมน์เพิ่มเติมสำหรับ Supabase ============
  seq INTEGER DEFAULT 1,                    -- ลำดับ stop ใน reference เดียวกัน
  route VARCHAR(50),                        -- route code
  drivers TEXT,                             -- รายชื่อคนขับ (comma-separated)
  is_origin_stop BOOLEAN DEFAULT FALSE,     -- เป็นจุดต้นทางหรือไม่
  materials TEXT,                           -- รายการสินค้า
  total_qty DECIMAL(12,2),                  -- ปริมาณรวม
  receiver_name VARCHAR(100),               -- ชื่อผู้รับน้ำมัน
  receiver_type VARCHAR(50),                -- ประเภทผู้รับ
  has_pumping BOOLEAN DEFAULT FALSE,        -- มีปั่นน้ำมัน
  has_transfer BOOLEAN DEFAULT FALSE,       -- มีโยกน้ำมัน
  job_closed BOOLEAN DEFAULT FALSE,         -- ปิดงานแล้วหรือยัง
  trip_ended BOOLEAN DEFAULT FALSE,         -- จบทริปแล้วหรือยัง
  vehicle_status VARCHAR(30),               -- สถานะรถหลังปิดงาน
  closed_by VARCHAR(100),                   -- ปิดงานโดยใคร
  ended_by VARCHAR(100),                    -- จบทริปโดยใคร
  accuracy DECIMAL(10,2),                   -- ความแม่นยำ GPS

  -- Constraints
  UNIQUE(reference, seq)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_jobdata_reference ON jobdata(reference);
CREATE INDEX IF NOT EXISTS idx_jobdata_status ON jobdata(status);
CREATE INDEX IF NOT EXISTS idx_jobdata_created_at ON jobdata(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobdata_ship_to_code ON jobdata(ship_to_code);

-- =====================================================
-- TABLE: alcohol_checks (alcoholcheck sheet)
-- =====================================================
-- ตรงกับ Google Sheets: alcoholcheck
CREATE TABLE IF NOT EXISTS alcohol_checks (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50),
  driver_name VARCHAR(100) NOT NULL,
  alcohol_value DECIMAL(5,3),
  image_url TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  accuracy DECIMAL(10,2),
  user_id VARCHAR(100),
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alcohol_reference ON alcohol_checks(reference);
CREATE INDEX IF NOT EXISTS idx_alcohol_driver ON alcohol_checks(driver_name);

-- =====================================================
-- TABLE: review_data (reviewdata sheet)
-- =====================================================
-- ตรงกับ Google Sheets: reviewdata - บันทึกการประเมิน + ลายเซ็น
CREATE TABLE IF NOT EXISTS review_data (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50),
  row_index INTEGER,
  ship_to_code VARCHAR(50),
  ship_to_name VARCHAR(200),
  user_id VARCHAR(100),
  score INTEGER,                            -- คะแนนประเมิน
  signature_url TEXT,                       -- URL ลายเซ็น
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  accuracy DECIMAL(10,2),
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reference ON review_data(reference);

-- =====================================================
-- TABLE: process_data (processdata sheet)
-- =====================================================
-- ตรงกับ Google Sheets: processdata - บันทึกข้อมูลผู้รับน้ำมัน
CREATE TABLE IF NOT EXISTS process_data (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50),
  row_index INTEGER,
  ship_to_code VARCHAR(50),
  ship_to_name VARCHAR(200),
  receiver_name VARCHAR(100),               -- ชื่อผู้รับน้ำมัน
  receiver_type VARCHAR(50),                -- ประเภทผู้รับ
  odo_value INTEGER,                        -- เลขไมล์
  has_pumping BOOLEAN DEFAULT FALSE,        -- มีปั่นน้ำมัน
  has_transfer BOOLEAN DEFAULT FALSE,       -- มีโยกน้ำมัน
  user_id VARCHAR(100),
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  accuracy DECIMAL(10,2),
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processdata_reference ON process_data(reference);

-- =====================================================
-- TABLE: close_job_data (closejobdata)
-- =====================================================
-- บันทึกการปิดงาน
CREATE TABLE IF NOT EXISTS close_job_data (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) NOT NULL,
  user_id VARCHAR(100),
  vehicle_desc VARCHAR(200),
  vehicle_status VARCHAR(30),               -- ready / maintenance
  hill_fee BOOLEAN DEFAULT FALSE,           -- ค่าขึ้นเขา
  bkk_fee BOOLEAN DEFAULT FALSE,            -- ค่าเข้า กทม
  repair_fee BOOLEAN DEFAULT FALSE,         -- นำรถเข้าซ่อม
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closejob_reference ON close_job_data(reference);

-- =====================================================
-- TABLE: user_profiles (userprofile sheet)
-- =====================================================
-- ตรงกับ Google Sheets: userprofile
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100) UNIQUE NOT NULL,     -- A: userId (LINE userId)
  display_name VARCHAR(200),                -- B: displayName
  picture_url TEXT,                         -- C: pictureUrl
  status VARCHAR(30) DEFAULT 'active',      -- D: status
  created_at TIMESTAMPTZ DEFAULT NOW(),     -- E: createdAt
  updated_at TIMESTAMPTZ DEFAULT NOW(),     -- F: updatedAt
  phone VARCHAR(20),                        -- G: phone (ถ้ามี)
  email VARCHAR(100),                       -- H: email (ถ้ามี)
  employee_id VARCHAR(50),                  -- I: employeeId (ถ้ามี)
  user_type VARCHAR(30) DEFAULT 'DRIVER'    -- J: userType (ADMIN/DRIVER/etc)
);

CREATE INDEX IF NOT EXISTS idx_userprofile_userid ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_userprofile_usertype ON user_profiles(user_type);

-- =====================================================
-- TABLE: register (register sheet)
-- =====================================================
-- ตรงกับ Google Sheets: register
CREATE TABLE IF NOT EXISTS register (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(100),
  display_name VARCHAR(200),
  picture_url TEXT,
  phone VARCHAR(20),
  email VARCHAR(100),
  employee_id VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pending',     -- pending / approved / rejected
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_register_userid ON register(user_id);
CREATE INDEX IF NOT EXISTS idx_register_status ON register(status);

-- =====================================================
-- TABLE: stations (Station sheet)
-- =====================================================
-- ตรงกับ Google Sheets: Station
CREATE TABLE IF NOT EXISTS stations (
  id SERIAL PRIMARY KEY,
  station_code VARCHAR(50) UNIQUE NOT NULL, -- A: stationKey
  station_code_alt VARCHAR(50),             -- B: stationKey2
  name VARCHAR(200),                        -- C: name
  lat DECIMAL(10,7),                        -- D: lat
  lng DECIMAL(10,7),                        -- E: lng
  radius_m INTEGER DEFAULT 200,             -- F: radiusMeters
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stations_code ON stations(station_code);

-- =====================================================
-- TABLE: origins (Origin sheet)
-- =====================================================
-- ตรงกับ Google Sheets: Origin
CREATE TABLE IF NOT EXISTS origins (
  id SERIAL PRIMARY KEY,
  origin_code VARCHAR(50) UNIQUE NOT NULL,  -- A: originKey
  name VARCHAR(200),                        -- B: name
  lat DECIMAL(10,7),                        -- C: lat
  lng DECIMAL(10,7),                        -- D: lng
  radius_m INTEGER DEFAULT 200,             -- E: radiusMeters
  route_code VARCHAR(50),                   -- F: routeCode
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_origins_code ON origins(origin_code);
CREATE INDEX IF NOT EXISTS idx_origins_route ON origins(route_code);

-- =====================================================
-- TABLE: admin_logs (adminlog sheet)
-- =====================================================
-- ตรงกับ Google Sheets: adminlog
CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id VARCHAR(100),
  action VARCHAR(100),                      -- action ที่ทำ
  target_type VARCHAR(50),                  -- job / user / etc
  target_id VARCHAR(100),                   -- reference / userId ที่ถูกแก้ไข
  old_value TEXT,                           -- ค่าเก่า (JSON)
  new_value TEXT,                           -- ค่าใหม่ (JSON)
  ip_address VARCHAR(50),
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adminlog_admin ON admin_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_adminlog_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_adminlog_timestamp ON admin_logs(timestamp DESC);

-- =====================================================
-- TABLE: extra_costs (extracost data)
-- =====================================================
-- สำหรับเก็บค่าใช้จ่ายพิเศษ (hillFee, bkkFee, repairFee แยกรายจุด)
CREATE TABLE IF NOT EXISTS extra_costs (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50),
  ship_to_code VARCHAR(50),
  ship_to_name VARCHAR(200),
  vehicle_desc VARCHAR(200),
  cost_type VARCHAR(50),                    -- hill / bkk / repair / pumping / transfer
  amount DECIMAL(12,2),
  user_id VARCHAR(100),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracost_reference ON extra_costs(reference);

-- =====================================================
-- STORAGE BUCKET: images
-- =====================================================
-- Note: Create this bucket in Supabase Dashboard > Storage
-- Name: images
-- Public: Yes (for easy image access)

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE jobdata ENABLE ROW LEVEL SECURITY;
ALTER TABLE alcohol_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_job_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE register ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_costs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
-- For production, you should create more restrictive policies

-- jobdata
CREATE POLICY "Allow public read on jobdata" ON jobdata FOR SELECT USING (true);
CREATE POLICY "Allow public insert on jobdata" ON jobdata FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on jobdata" ON jobdata FOR UPDATE USING (true);

-- alcohol_checks
CREATE POLICY "Allow public read on alcohol_checks" ON alcohol_checks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on alcohol_checks" ON alcohol_checks FOR INSERT WITH CHECK (true);

-- review_data
CREATE POLICY "Allow public read on review_data" ON review_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert on review_data" ON review_data FOR INSERT WITH CHECK (true);

-- process_data
CREATE POLICY "Allow public read on process_data" ON process_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert on process_data" ON process_data FOR INSERT WITH CHECK (true);

-- close_job_data
CREATE POLICY "Allow public read on close_job_data" ON close_job_data FOR SELECT USING (true);
CREATE POLICY "Allow public insert on close_job_data" ON close_job_data FOR INSERT WITH CHECK (true);

-- user_profiles
CREATE POLICY "Allow public read on user_profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert on user_profiles" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on user_profiles" ON user_profiles FOR UPDATE USING (true);

-- register
CREATE POLICY "Allow public read on register" ON register FOR SELECT USING (true);
CREATE POLICY "Allow public insert on register" ON register FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on register" ON register FOR UPDATE USING (true);

-- stations (read-only for everyone)
CREATE POLICY "Allow public read on stations" ON stations FOR SELECT USING (true);

-- origins (read-only for everyone)
CREATE POLICY "Allow public read on origins" ON origins FOR SELECT USING (true);

-- admin_logs (read-only, insert by admin only in production)
CREATE POLICY "Allow public read on admin_logs" ON admin_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on admin_logs" ON admin_logs FOR INSERT WITH CHECK (true);

-- extra_costs
CREATE POLICY "Allow public read on extra_costs" ON extra_costs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on extra_costs" ON extra_costs FOR INSERT WITH CHECK (true);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE jobdata;
ALTER PUBLICATION supabase_realtime ADD TABLE alcohol_checks;

-- =====================================================
-- TRIGGER: Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobdata_updated_at
  BEFORE UPDATE ON jobdata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_userprofiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS (Optional - for easier querying)
-- =====================================================

-- View: Job summary by reference
CREATE OR REPLACE VIEW v_job_summary AS
SELECT
  reference,
  vehicle_desc,
  COUNT(*) as total_stops,
  SUM(CASE WHEN checkout_time IS NOT NULL THEN 1 ELSE 0 END) as completed_stops,
  MIN(checkin_time) as first_checkin,
  MAX(checkout_time) as last_checkout,
  MAX(job_closed_at) as closed_at,
  MAX(trip_ended_at) as ended_at,
  BOOL_OR(job_closed) as is_closed,
  BOOL_OR(trip_ended) as is_ended
FROM jobdata
GROUP BY reference, vehicle_desc;

-- View: Driver alcohol check status
CREATE OR REPLACE VIEW v_alcohol_status AS
SELECT
  reference,
  driver_name,
  alcohol_value,
  created_at,
  CASE
    WHEN alcohol_value <= 0 THEN 'PASS'
    WHEN alcohol_value > 0 THEN 'FAIL'
    ELSE 'UNKNOWN'
  END as result
FROM alcohol_checks
ORDER BY created_at DESC;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment below to insert sample data

/*
-- Sample origins
INSERT INTO origins (origin_code, name, lat, lng, radius_m, route_code) VALUES
  ('TOP_SR', 'ไทยออยล์ ศรีราชา', 13.1100258, 100.9144418, 500, '001'),
  ('TOP_LC', 'ไทยออยล์ แหลมฉบัง', 13.0850000, 100.8950000, 500, '002');

-- Sample stations
INSERT INTO stations (station_code, station_code_alt, name, lat, lng, radius_m) VALUES
  ('ST001', 'PTT001', 'ปั๊ม ปตท. สาขา 1', 13.7563, 100.5018, 100),
  ('ST002', 'PTT002', 'ปั๊ม ปตท. สาขา 2', 13.8456, 100.5678, 100);

-- Sample jobdata
INSERT INTO jobdata (reference, seq, vehicle_desc, ship_to_code, ship_to_name, is_origin_stop, dest_lat, dest_lng, materials, total_qty, drivers, status)
VALUES
  ('2511S15403', 1, 'รถ ABC-1234', 'TOP_SR', 'ไทยออยล์ ศรีราชา', true, 13.1100258, 100.9144418, 'น้ำมันดีเซล', 20000, 'สมชาย,สมหญิง', 'PENDING'),
  ('2511S15403', 2, 'รถ ABC-1234', 'ST001', 'ปั๊ม ปตท. สาขา 1', false, 13.7563, 100.5018, 'น้ำมันดีเซล', 10000, 'สมชาย,สมหญิง', 'PENDING'),
  ('2511S15403', 3, 'รถ ABC-1234', 'ST002', 'ปั๊ม ปตท. สาขา 2', false, 13.8456, 100.5678, 'น้ำมันดีเซล', 10000, 'สมชาย,สมหญิง', 'PENDING');
*/

-- =====================================================
-- DONE!
-- =====================================================
-- Tables created:
-- 1. jobdata         - ข้อมูลงาน/จุดส่ง (31+ columns)
-- 2. alcohol_checks  - บันทึกแอลกอฮอล์
-- 3. review_data     - บันทึกการประเมิน + ลายเซ็น
-- 4. process_data    - บันทึกข้อมูลผู้รับน้ำมัน
-- 5. close_job_data  - บันทึกการปิดงาน
-- 6. user_profiles   - โปรไฟล์ผู้ใช้
-- 7. register        - ข้อมูลลงทะเบียน
-- 8. stations        - ข้อมูลสถานี
-- 9. origins         - ข้อมูลต้นทาง
-- 10. admin_logs     - บันทึกกิจกรรม admin
-- 11. extra_costs    - ค่าใช้จ่ายพิเศษ
--
-- Views:
-- 1. v_job_summary   - สรุปงานตาม reference
-- 2. v_alcohol_status - สถานะการตรวจแอลกอฮอล์
--
-- After running this script:
-- 1. Go to Supabase Dashboard > Settings > API
-- 2. Copy your Project URL and anon/public key
-- 3. Update SUPABASE_URL and SUPABASE_ANON_KEY in index-supabase.html
-- 4. Create 'images' bucket in Storage (Dashboard > Storage > New bucket)
-- 5. Make the bucket public for image access
-- =====================================================
