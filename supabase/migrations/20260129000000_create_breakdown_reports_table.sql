-- Migration file: 20260129000000_create_breakdown_reports_table.sql
-- Run in Supabase Dashboard > SQL Editor
-- Creates table for driver breakdown/accident reports

-- Create breakdown_reports table
CREATE TABLE IF NOT EXISTS public.breakdown_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT, -- Optional: current job reference if driver is on a trip
    vehicle_desc TEXT, -- Vehicle description
    driver_user_id TEXT NOT NULL, -- LINE User ID of driver
    driver_name TEXT, -- Driver display name (for easier viewing)

    -- Report details
    report_type TEXT NOT NULL CHECK (report_type IN ('breakdown', 'accident', 'maintenance', 'emergency')),
    description TEXT NOT NULL,
    location TEXT, -- Text description or "lat, lng" format
    lat NUMERIC, -- Latitude
    lng NUMERIC, -- Longitude
    photo_url TEXT, -- Supabase Storage URL for photo

    -- Driver's requests
    request_new_vehicle BOOLEAN DEFAULT true,
    request_close_trip BOOLEAN DEFAULT false,

    -- Admin action
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'resolved', 'cancelled')),
    assigned_vehicle TEXT, -- New vehicle assigned by admin
    admin_notes TEXT, -- Admin notes
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT, -- Admin user ID

    -- Job info
    incomplete_stops INTEGER DEFAULT 0, -- Number of stops not yet completed

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_reference ON public.breakdown_reports(reference);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_driver_user_id ON public.breakdown_reports(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_status ON public.breakdown_reports(status);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_report_type ON public.breakdown_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_created_at ON public.breakdown_reports(created_at DESC);

-- Enable RLS
ALTER TABLE public.breakdown_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drivers can insert their own reports
CREATE POLICY "breakdown_reports_insert_policy" ON public.breakdown_reports
    FOR INSERT WITH CHECK (true);

-- Drivers can view their own reports (by driver_user_id)
CREATE POLICY "breakdown_reports_select_own_policy" ON public.breakdown_reports
    FOR SELECT USING (driver_user_id = auth.uid()::text);

-- Admins can view all reports
CREATE POLICY "breakdown_reports_select_admin_policy" ON public.breakdown_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()::text
            AND user_profiles.user_type = 'ADMIN'
        )
    );

-- Admins can update reports
CREATE POLICY "breakdown_reports_update_admin_policy" ON public.breakdown_reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.user_id = auth.uid()::text
            AND user_profiles.user_type = 'ADMIN'
        )
    );

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_breakdown_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_breakdown_reports_updated_at
    BEFORE UPDATE ON public.breakdown_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_breakdown_reports_updated_at();

-- Create storage bucket for breakdown photos (if not exists)
-- Note: This needs to be done manually in Supabase Dashboard > Storage
-- Bucket name: breakdown-photos
-- Public: Yes

-- Comments for documentation
COMMENT ON TABLE public.breakdown_reports IS 'Driver breakdown/accident reports for admin notification';
COMMENT ON COLUMN public.breakdown_reports.report_type IS 'Type of incident: breakdown, accident, maintenance, emergency';
COMMENT ON COLUMN public.breakdown_reports.request_new_vehicle IS 'Driver requests a new vehicle to continue the trip';
COMMENT ON COLUMN public.breakdown_reports.request_close_trip IS 'Driver requests to close/end the trip';
COMMENT ON COLUMN public.breakdown_reports.incomplete_stops IS 'Number of delivery stops not yet completed';
