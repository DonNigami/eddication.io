-- Create fuel siphoning records table
-- Migration: 20260119_create_fuel_siphoning_table.sql

CREATE TABLE IF NOT EXISTS public.fuel_siphoning (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_name TEXT NOT NULL,
    station_code TEXT,
    customer_name TEXT,
    customer_code TEXT,
    driver_user_id TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    vehicle_plate TEXT NOT NULL,
    liters NUMERIC(10,2) NOT NULL,
    siphon_date DATE NOT NULL,
    siphon_time TIME,
    evidence_image_url TEXT,
    notes TEXT,
    reported_by TEXT NOT NULL,
    status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'verified', 'resolved', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_fuel_siphoning_driver_user_id ON public.fuel_siphoning(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_siphoning_siphon_date ON public.fuel_siphoning(siphon_date);
CREATE INDEX IF NOT EXISTS idx_fuel_siphoning_status ON public.fuel_siphoning(status);
CREATE INDEX IF NOT EXISTS idx_fuel_siphoning_station_code ON public.fuel_siphoning(station_code);

-- Enable RLS
ALTER TABLE public.fuel_siphoning ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read all records
CREATE POLICY "fuel_siphoning_select_policy" ON public.fuel_siphoning
    FOR SELECT USING (true);

-- Allow authenticated users to insert records
CREATE POLICY "fuel_siphoning_insert_policy" ON public.fuel_siphoning
    FOR INSERT WITH CHECK (true);

-- Allow authenticated users to update records
CREATE POLICY "fuel_siphoning_update_policy" ON public.fuel_siphoning
    FOR UPDATE USING (true);

-- Create storage bucket for fuel siphoning evidence images
INSERT INTO storage.buckets (id, name, public)
VALUES ('fuel-siphoning-evidence', 'fuel-siphoning-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for fuel-siphoning-evidence bucket
CREATE POLICY "fuel_siphoning_evidence_upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'fuel-siphoning-evidence');

CREATE POLICY "fuel_siphoning_evidence_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'fuel-siphoning-evidence');
