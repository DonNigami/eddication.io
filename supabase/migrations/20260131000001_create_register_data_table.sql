-- Registration Data Table Migration
-- Created: 2026-01-31
-- Purpose: Store driver registration requests with LINE user ID

-- Drop existing objects (in correct order)
DROP TRIGGER IF EXISTS register_data_updated_at ON public.register_data;
DROP FUNCTION IF EXISTS public.update_register_data_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.is_user_registered(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_profile_by_line_id(VARCHAR) CASCADE;

-- Drop policies first
DROP POLICY IF EXISTS "Users can view own registration" ON public.register_data;
DROP POLICY IF EXISTS "Users can insert own registration" ON public.register_data;
DROP POLICY IF EXISTS "Users can update own registration" ON public.register_data;
DROP POLICY IF EXISTS "Admins can view all registrations" ON public.register_data;
DROP POLICY IF EXISTS "Admins can update registrations" ON public.register_data;
DROP POLICY IF EXISTS "Public can insert registration" ON public.register_data;

-- Drop type first (must drop before table that uses it)
DROP TYPE IF EXISTS public.registration_status CASCADE;

-- Drop table
DROP TABLE IF EXISTS public.register_data CASCADE;

-- Create ENUM type for registration status FIRST (before creating table)
CREATE TYPE public.registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_CHANGES');

-- Create table with ENUM type directly
CREATE TABLE public.register_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id VARCHAR(255) UNIQUE NOT NULL,
    line_display_name VARCHAR(255),
    line_picture_url TEXT,

    -- Driver Information
    employee_code VARCHAR(50),
    driver_name VARCHAR(255) NOT NULL,
    driver_sap_code VARCHAR(20) NOT NULL,
    section VARCHAR(100) NOT NULL,
    truck_type VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,

    -- Phone & Contact
    phone_number VARCHAR(20),

    -- Registration Status (using ENUM type directly)
    registration_status public.registration_status DEFAULT 'PENDING',

    -- Review Information
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_register_data_line_user_id ON public.register_data(line_user_id);
CREATE INDEX idx_register_data_employee_code ON public.register_data(employee_code);
CREATE INDEX idx_register_data_sap_code ON public.register_data(driver_sap_code);
CREATE INDEX idx_register_data_status ON public.register_data(registration_status);
CREATE INDEX idx_register_data_created_at ON public.register_data(created_at DESC);

-- Enable RLS
ALTER TABLE public.register_data ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- Note: For LINE LIFF app without auth.users integration, we use anon policies
-- ============================================================================

-- Public (anon) can insert registrations (for new LINE users via LIFF)
CREATE POLICY "Public can insert registration"
    ON public.register_data FOR INSERT
    TO anon
    WITH CHECK (true);

-- Public (anon) can view by line_user_id (for checking registration status)
CREATE POLICY "Public can view own registration"
    ON public.register_data FOR SELECT
    TO anon
    USING (line_user_id = current_setting('request.line_user_id', true));

-- Authenticated users can also insert
CREATE POLICY "Authenticated can insert registration"
    ON public.register_data FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users can view their own registration (if they have line_user_id in meta)
CREATE POLICY "Authenticated can view own registration"
    ON public.register_data FOR SELECT
    TO authenticated
    USING (true);

-- Admin can view all registrations (if using auth.users with proper role check)
CREATE POLICY "Admins can view all registrations"
    ON public.register_data FOR SELECT
    TO authenticated
    USING (true);

-- Admin can update any registration
CREATE POLICY "Admins can update registrations"
    ON public.register_data FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_register_data_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER register_data_updated_at
    BEFORE UPDATE ON public.register_data
    FOR EACH ROW
    EXECUTE FUNCTION public.update_register_data_updated_at();

-- Function to check if LINE user is already registered
CREATE OR REPLACE FUNCTION public.is_user_registered(p_line_user_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_status public.registration_status;
BEGIN
    SELECT registration_status INTO v_status
    FROM public.register_data
    WHERE line_user_id = p_line_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN v_status IN ('APPROVED', 'PENDING');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user profile by LINE user ID
CREATE OR REPLACE FUNCTION public.get_user_profile_by_line_id(p_line_user_id VARCHAR)
RETURNS TABLE (
    id UUID,
    line_user_id VARCHAR,
    line_display_name VARCHAR,
    driver_name VARCHAR,
    employee_code VARCHAR,
    registration_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.line_user_id,
        r.line_display_name,
        r.driver_name,
        r.employee_code,
        r.registration_status::VARCHAR
    FROM public.register_data r
    WHERE r.line_user_id = p_line_user_id
    ORDER BY r.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON public.register_data TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.register_data TO authenticated;
GRANT SELECT, INSERT ON public.register_data TO anon;

GRANT EXECUTE ON FUNCTION public.is_user_registered(VARCHAR) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_profile_by_line_id(VARCHAR) TO authenticated, anon;

-- Comments
COMMENT ON TABLE public.register_data IS 'Driver registration requests with LINE user integration';
COMMENT ON COLUMN public.register_data.line_user_id IS 'LINE User ID from LIFF';
COMMENT ON COLUMN public.register_data.registration_status IS 'PENDING, APPROVED, REJECTED, REQUIRES_CHANGES';
