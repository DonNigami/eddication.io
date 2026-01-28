-- Create vehicle breakdown records table
-- Migration: 20260128_create_vehicle_breakdown_table.sql

CREATE TABLE IF NOT EXISTS public.vehicle_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE,
    original_ref TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_user_id TEXT,
    original_vehicle TEXT NOT NULL,
    new_vehicle TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'cancelled')),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_reference ON public.vehicle_breakdown(reference);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_original_ref ON public.vehicle_breakdown(original_ref);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_driver_user_id ON public.vehicle_breakdown(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_status ON public.vehicle_breakdown(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_breakdown_created_at ON public.vehicle_breakdown(created_at DESC);

-- Enable RLS
ALTER TABLE public.vehicle_breakdown ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to read all records
CREATE POLICY "vehicle_breakdown_select_policy" ON public.vehicle_breakdown
    FOR SELECT USING (true);

-- Allow authenticated users to insert records
CREATE POLICY "vehicle_breakdown_insert_policy" ON public.vehicle_breakdown
    FOR INSERT WITH CHECK (true);

-- Allow authenticated users to update records
CREATE POLICY "vehicle_breakdown_update_policy" ON public.vehicle_breakdown
    FOR UPDATE USING (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_vehicle_breakdown_updated_at
    BEFORE UPDATE ON public.vehicle_breakdown
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
