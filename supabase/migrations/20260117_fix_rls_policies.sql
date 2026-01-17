-- Fix RLS Policies for Driver Tracking Tables
-- Created: 2026-01-17

-- ============================================
-- Drop existing policies (if any)
-- ============================================
DROP POLICY IF EXISTS "Allow public read on driver_jobs" ON driver_jobs;
DROP POLICY IF EXISTS "Allow public insert on driver_jobs" ON driver_jobs;
DROP POLICY IF EXISTS "Allow public update on driver_jobs" ON driver_jobs;

DROP POLICY IF EXISTS "Allow public read on driver_stops" ON driver_stops;
DROP POLICY IF EXISTS "Allow public insert on driver_stops" ON driver_stops;
DROP POLICY IF EXISTS "Allow public update on driver_stops" ON driver_stops;

DROP POLICY IF EXISTS "Allow public read on driver_alcohol_checks" ON driver_alcohol_checks;
DROP POLICY IF EXISTS "Allow public insert on driver_alcohol_checks" ON driver_alcohol_checks;

DROP POLICY IF EXISTS "Allow public read on driver_logs" ON driver_logs;
DROP POLICY IF EXISTS "Allow public insert on driver_logs" ON driver_logs;

-- ============================================
-- Create new policies (Allow all operations)
-- ============================================

-- driver_jobs policies
CREATE POLICY "Enable read access for all users" ON driver_jobs
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON driver_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON driver_jobs
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON driver_jobs
  FOR DELETE USING (true);

-- driver_stops policies
CREATE POLICY "Enable read access for all users" ON driver_stops
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON driver_stops
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON driver_stops
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON driver_stops
  FOR DELETE USING (true);

-- driver_alcohol_checks policies
CREATE POLICY "Enable read access for all users" ON driver_alcohol_checks
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON driver_alcohol_checks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON driver_alcohol_checks
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON driver_alcohol_checks
  FOR DELETE USING (true);

-- driver_logs policies
CREATE POLICY "Enable read access for all users" ON driver_logs
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON driver_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON driver_logs
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON driver_logs
  FOR DELETE USING (true);

-- ============================================
-- Verify RLS is enabled
-- ============================================
ALTER TABLE driver_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_alcohol_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Success message
-- ============================================
SELECT 'RLS Policies updated successfully for all driver_* tables' as status;
