-- Driver Tracking Tables Migration
-- Created: 2026-01-17

-- ============================================
-- Table: driver_jobs
-- Description: หัวงานขนส่ง (Job Header)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL, -- เลข Reference (เช่น HXX-123456)
  vehicle_desc TEXT, -- ทะเบียนรถ
  drivers TEXT, -- รายชื่อคนขับ (comma separated)
  status TEXT DEFAULT 'active', -- active, closed, completed
  start_odo INTEGER, -- เลขไมล์เริ่มต้น
  end_odo INTEGER, -- เลขไมล์สิ้นสุด
  start_location JSONB, -- {lat, lng} จุดเริ่มต้น
  end_location JSONB, -- {lat, lng} จุดสิ้นสุด
  vehicle_status TEXT, -- สถานะรถหลังจบงาน
  fees NUMERIC(10,2), -- ค่าธรรมเนียม
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- LINE User ID
  updated_by TEXT
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_driver_jobs_reference ON driver_jobs(reference);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_status ON driver_jobs(status);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_created_at ON driver_jobs(created_at DESC);

-- ============================================
-- Table: driver_stops
-- Description: จุดส่งของแต่ละงาน (Delivery Stops)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES driver_jobs(id) ON DELETE CASCADE,
  reference TEXT NOT NULL, -- เลข Reference (FK to driver_jobs)
  stop_number INTEGER NOT NULL, -- ลำดับจุดส่ง (1, 2, 3, ...)
  stop_name TEXT, -- ชื่อจุดส่ง
  address TEXT, -- ที่อยู่
  
  -- Check-in
  checkin_time TIMESTAMPTZ,
  checkin_location JSONB, -- {lat, lng, accuracy}
  checkin_by TEXT, -- LINE User ID
  
  -- Fuel
  fuel_time TIMESTAMPTZ,
  fuel_location JSONB,
  fuel_odo INTEGER,
  fuel_by TEXT,
  
  -- Unload
  unload_time TIMESTAMPTZ,
  unload_location JSONB,
  unload_receiver TEXT, -- ชื่อผู้รับ
  unload_by TEXT,
  
  -- Check-out
  checkout_time TIMESTAMPTZ,
  checkout_location JSONB,
  checkout_odo INTEGER,
  checkout_by TEXT,
  
  status TEXT DEFAULT 'pending', -- pending, checkin, fuel, unload, checkout
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_driver_stops_job_id ON driver_stops(job_id);
CREATE INDEX IF NOT EXISTS idx_driver_stops_reference ON driver_stops(reference);
CREATE INDEX IF NOT EXISTS idx_driver_stops_stop_number ON driver_stops(stop_number);

-- ============================================
-- Table: driver_alcohol_checks
-- Description: บันทึกการตรวจแอลกอฮอล์
-- ============================================
CREATE TABLE IF NOT EXISTS driver_alcohol_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES driver_jobs(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  driver_name TEXT NOT NULL, -- ชื่อคนขับที่ตรวจ
  alcohol_value NUMERIC(4,3) NOT NULL, -- ค่าแอลกอฮอล์ (0.000 - 5.000)
  image_url TEXT, -- URL รูปภาพในSupa base Storage
  location JSONB, -- {lat, lng}
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  checked_by TEXT, -- LINE User ID
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_job_id ON driver_alcohol_checks(job_id);
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_reference ON driver_alcohol_checks(reference);
CREATE INDEX IF NOT EXISTS idx_alcohol_checks_checked_at ON driver_alcohol_checks(checked_at DESC);

-- ============================================
-- Table: driver_logs
-- Description: Log การทำงานต่างๆ (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES driver_jobs(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  action TEXT NOT NULL, -- search, checkin, checkout, fuel, unload, alcohol, close, endtrip
  details JSONB, -- รายละเอียดเพิ่มเติม
  location JSONB, -- {lat, lng}
  user_id TEXT, -- LINE User ID
  user_name TEXT, -- LINE Display Name
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_driver_logs_job_id ON driver_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_driver_logs_reference ON driver_logs(reference);
CREATE INDEX IF NOT EXISTS idx_driver_logs_action ON driver_logs(action);
CREATE INDEX IF NOT EXISTS idx_driver_logs_created_at ON driver_logs(created_at DESC);

-- ============================================
-- Updated_at Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_driver_jobs_updated_at ON driver_jobs;
CREATE TRIGGER update_driver_jobs_updated_at
  BEFORE UPDATE ON driver_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_stops_updated_at ON driver_stops;
CREATE TRIGGER update_driver_stops_updated_at
  BEFORE UPDATE ON driver_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE driver_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_alcohol_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_logs ENABLE ROW LEVEL SECURITY;

-- Public read/write access (for testing - adjust in production)
CREATE POLICY "Allow public read on driver_jobs" ON driver_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on driver_jobs" ON driver_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on driver_jobs" ON driver_jobs FOR UPDATE USING (true);

CREATE POLICY "Allow public read on driver_stops" ON driver_stops FOR SELECT USING (true);
CREATE POLICY "Allow public insert on driver_stops" ON driver_stops FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on driver_stops" ON driver_stops FOR UPDATE USING (true);

CREATE POLICY "Allow public read on driver_alcohol_checks" ON driver_alcohol_checks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on driver_alcohol_checks" ON driver_alcohol_checks FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on driver_logs" ON driver_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert on driver_logs" ON driver_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- Sample Data (for testing)
-- ============================================
INSERT INTO driver_jobs (reference, vehicle_desc, drivers, status, start_odo)
VALUES 
  ('2601S16472', 'ABC-1234', 'นายสมชาย ใจดี, นายสมศักดิ์ มีชัย', 'active', 12500),
  ('HXX-123456', 'DEF-5678', 'นายธนา รักดี', 'active', 8500)
ON CONFLICT (reference) DO NOTHING;

-- Add stops for first job
INSERT INTO driver_stops (job_id, reference, stop_number, stop_name, address, status)
SELECT 
  j.id,
  j.reference,
  1,
  'คลัง A',
  'เขตบางนา กรุงเทพฯ',
  'pending'
FROM driver_jobs j WHERE j.reference = '2601S16472'
ON CONFLICT DO NOTHING;

INSERT INTO driver_stops (job_id, reference, stop_number, stop_name, address, status)
SELECT 
  j.id,
  j.reference,
  2,
  'ลูกค้า B',
  'เขตบางบัว สมุทรปราการ',
  'pending'
FROM driver_jobs j WHERE j.reference = '2601S16472'
ON CONFLICT DO NOTHING;

-- ============================================
-- Storage Bucket for Alcohol Images
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('alcohol-checks', 'alcohol-checks', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to upload/download
CREATE POLICY "Allow public upload to alcohol-checks"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'alcohol-checks');

CREATE POLICY "Allow public read from alcohol-checks"
ON storage.objects FOR SELECT
USING (bucket_id = 'alcohol-checks');
