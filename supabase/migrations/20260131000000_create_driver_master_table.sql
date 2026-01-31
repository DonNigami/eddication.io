-- Driver Master Table Migration
-- Created: 2026-01-31

-- Drop table first (CASCADE removes all dependencies: policies, triggers, etc.)
DROP TABLE IF EXISTS public.driver_master CASCADE;

-- Create table
CREATE TABLE public.driver_master (
    employee_code VARCHAR(50) PRIMARY KEY,
    driver_name VARCHAR(255) NOT NULL,
    driver_sap_code VARCHAR(20) NOT NULL,
    section VARCHAR(100) NOT NULL,
    truck_type VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_driver_master_sap_code ON public.driver_master(driver_sap_code);
CREATE INDEX idx_driver_master_section ON public.driver_master(section);
CREATE INDEX idx_driver_master_truck_type ON public.driver_master(truck_type);

-- Enable RLS
ALTER TABLE public.driver_master ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "service_role_all" ON public.driver_master TO service_role USING (true) WITH CHECK (true);

-- Authenticated users - SELECT only
CREATE POLICY "authenticated_select" ON public.driver_master FOR SELECT TO authenticated USING (true);

-- Authenticated users - INSERT
CREATE POLICY "authenticated_insert" ON public.driver_master FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users - UPDATE
CREATE POLICY "authenticated_update" ON public.driver_master FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_driver_master_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER driver_master_updated_at BEFORE UPDATE ON public.driver_master FOR EACH ROW EXECUTE FUNCTION public.update_driver_master_updated_at();

-- Permissions
GRANT ALL ON public.driver_master TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.driver_master TO authenticated;
GRANT SELECT ON public.driver_master TO anon;
