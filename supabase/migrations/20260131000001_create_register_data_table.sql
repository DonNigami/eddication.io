-- Registration Data Table Migration
-- Created: 2026-01-31
-- Purpose: Store driver registration requests with LINE user ID

-- Drop table first (CASCADE removes all dependencies: policies, triggers, etc.)
DROP TABLE IF EXISTS public.register_data CASCADE;

-- Create table
CREATE TABLE public.register_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id VARCHAR(255) UNIQUE NOT NULL,
    line_display_name VARCHAR(255),
    line_picture_url TEXT,

    -- Driver Information (matching driver_master structure)
    employee_code VARCHAR(50),
    driver_name VARCHAR(255) NOT NULL,
    driver_sap_code VARCHAR(20) NOT NULL,
    section VARCHAR(100) NOT NULL,
    truck_type VARCHAR(50) NOT NULL,
    position VARCHAR(100) NOT NULL,

    -- Phone & Contact
    phone_number VARCHAR(20),

    -- Registration Status
    registration_status VARCHAR(20) DEFAULT 'PENDING',
    -- Possible values: 'PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_CHANGES'

    -- Review Information
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ENUM type for registration status
CREATE TYPE registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_CHANGES');
ALTER TABLE public.register_data ALTER COLUMN registration_status TYPE registration_status USING registration_status::registration_status;

-- Indexes
CREATE INDEX idx_register_data_line_user_id ON public.register_data(line_user_id);
CREATE INDEX idx_register_data_employee_code ON public.register_data(employee_code);
CREATE INDEX idx_register_data_sap_code ON public.register_data(driver_sap_code);
CREATE INDEX idx_register_data_status ON public.register_data(registration_status);
CREATE INDEX idx_register_data_created_at ON public.register_data(created_at DESC);

-- Enable RLS
ALTER TABLE public.register_data ENABLE ROW LEVEL SECURITY;

-- Users can view their own registration
CREATE POLICY "Users can view own registration"
    ON public.register_data FOR SELECT
    TO authenticated
    USING (line_user_id = (SELECT raw_user_meta_data->>'line_user_id' FROM auth.users WHERE id = auth.uid()));

-- Users can insert their own registration
CREATE POLICY "Users can insert own registration"
    ON public.register_data FOR INSERT
    TO authenticated
    WITH CHECK (line_user_id = (SELECT raw_user_meta_data->>'line_user_id' FROM auth.users WHERE id = auth.uid()));

-- Users can update their own registration (only if pending)
CREATE POLICY "Users can update own registration"
    ON public.register_data FOR UPDATE
    TO authenticated
    USING (
        line_user_id = (SELECT raw_user_meta_data->>'line_user_id' FROM auth.users WHERE id = auth.uid())
        AND registration_status = 'PENDING'
    )
    WITH CHECK (
        line_user_id = (SELECT raw_user_meta_data->>'line_user_id' FROM auth.users WHERE id = auth.uid())
        AND registration_status = 'PENDING'
    );

-- Admin can view all registrations
CREATE POLICY "Admins can view all registrations"
    ON public.register_data FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'ADMIN'
        )
    );

-- Admin can update any registration
CREATE POLICY "Admins can update registrations"
    ON public.register_data FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND user_type = 'ADMIN'
        )
    );

-- Public (anon) can insert registrations (for new LINE users)
CREATE POLICY "Public can insert registration"
    ON public.register_data FOR INSERT
    TO anon
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
    v_status VARCHAR(20);
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
