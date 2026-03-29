-- PTG eZView Integration - PostgreSQL Schema
-- ใช้สำหรับเก็บข้อมูลจาก PTG eZView API

-- ============================================
-- TRIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    trip_id TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_trip_id ON trips(trip_id);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at);
CREATE INDEX IF NOT EXISTS idx_trips_data_gin ON trips USING GIN (data);

-- ============================================
-- TRIP DETAILS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trip_details (
    id SERIAL PRIMARY KEY,
    trip_id TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trip_details_trip_id ON trip_details(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_details_created_at ON trip_details(created_at);
CREATE INDEX IF NOT EXISTS idx_trip_details_data_gin ON trip_details USING GIN (data);

-- ============================================
-- SYNC LOG TABLE (optional - for tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type TEXT NOT NULL, -- 'full', 'incremental'
    status TEXT NOT NULL, -- 'success', 'error', 'running'
    trips_fetched INTEGER DEFAULT 0,
    trip_details_fetched INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to trips table
CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to trip_details table
CREATE TRIGGER update_trip_details_updated_at
    BEFORE UPDATE ON trip_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS (optional - for easier querying)
-- ============================================

-- Summary view
CREATE OR REPLACE VIEW v_trip_summary AS
SELECT
    trip_id,
    data->>'status' as status,
    data->>'origin' as origin,
    data->>'destination' as destination,
    (data->>'openDateTime')::timestamp as open_date_time,
    created_at,
    updated_at
FROM trips;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE trips IS 'Store trip data from PTG eZView API';
COMMENT ON TABLE trip_details IS 'Store trip detail data from PTG eZView API';
COMMENT ON TABLE sync_logs IS 'Track sync operations';
COMMENT ON VIEW v_trip_summary IS 'Summary view of trips for easy querying';
