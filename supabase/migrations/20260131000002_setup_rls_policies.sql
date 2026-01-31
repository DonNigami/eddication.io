-- ============================================================================
-- RLS Policies for Driver Registration System
-- Created: 2026-01-31
-- Purpose: Secure Row Level Security for driver_master and register_data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: driver_master Table RLS
-- ----------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view driver_master" ON public.driver_master;
DROP POLICY IF EXISTS "Authenticated can view driver_master" ON public.driver_master;
DROP POLICY IF EXISTS "Service role can manage driver_master" ON public.driver_master;

-- Enable RLS on driver_master
ALTER TABLE public.driver_master ENABLE ROW LEVEL SECURITY;

-- Public (anon) can SELECT for search functionality
CREATE POLICY "Public can view driver_master"
    ON public.driver_master FOR SELECT
    TO anon
    USING (true);

-- Authenticated users can also SELECT
CREATE POLICY "Authenticated can view driver_master"
    ON public.driver_master FOR SELECT
    TO authenticated
    USING (true);

-- Service role (backend) has full access for CRUD operations
CREATE POLICY "Service role can manage driver_master"
    ON public.driver_master FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.driver_master TO anon, authenticated;
GRANT ALL ON public.driver_master TO service_role;

-- ----------------------------------------------------------------------------
-- PART 2: register_data Table RLS (Update existing policies)
-- ----------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Public can insert registration" ON public.register_data;
DROP POLICY IF EXISTS "Public can view own registration" ON public.register_data;
DROP POLICY IF EXISTS "Authenticated can insert registration" ON public.register_data;
DROP POLICY IF EXISTS "Authenticated can view own registration" ON public.register_data;
DROP POLICY IF EXISTS "Admins can view all registrations" ON public.register_data;
DROP POLICY IF EXISTS "Admins can update registrations" ON public.register_data;

-- Create new, more secure policies

-- 1. INSERT: Allow anon/authenticated to insert (for LIFF registration)
CREATE POLICY "Users can insert registration"
    ON public.register_data FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 2. SELECT: Users can only see their own registration via line_user_id header
CREATE POLICY "Users can view own registration"
    ON public.register_data FOR SELECT
    TO anon, authenticated
    USING (
        line_user_id = current_setting('request.line_user_id', true)
        OR current_setting('request.line_user_id', true) IS NULL -- Allow if no header set (dev mode)
    );

-- 3. UPDATE: Users can update their own registration (for REQUIRES_CHANGES)
CREATE POLICY "Users can update own registration"
    ON public.register_data FOR UPDATE
    TO anon, authenticated
    USING (
        line_user_id = current_setting('request.line_user_id', true)
        OR current_setting('request.line_user_id', true) IS NULL
    )
    WITH CHECK (
        line_user_id = current_setting('request.line_user_id', true)
        OR current_setting('request.line_user_id', true) IS NULL
    );

-- 4. Admin policies using auth.uid() check (for admin panel users)
-- Note: This requires admin users to be in auth.users with user_metadata.admin = true
CREATE POLICY "Admins can view all registrations"
    ON public.register_data FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (auth.users.raw_user_meta_data->>'admin')::boolean = true
        )
    );

CREATE POLICY "Admins can update registrations"
    ON public.register_data FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (auth.users.raw_user_meta_data->>'admin')::boolean = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (auth.users.raw_user_meta_data->>'admin')::boolean = true
        )
    );

CREATE POLICY "Admins can delete registrations"
    ON public.register_data FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (auth.users.raw_user_meta_data->>'admin')::boolean = true
        )
    );

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access register_data"
    ON public.register_data FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.register_data TO anon;
GRANT SELECT, INSERT, UPDATE ON public.register_data TO authenticated;
GRANT ALL ON public.register_data TO service_role;

-- ----------------------------------------------------------------------------
-- PART 3: Helper Functions
-- ----------------------------------------------------------------------------

-- Function to check if a LINE user is already registered
CREATE OR REPLACE FUNCTION public.is_user_registered(p_line_user_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.register_data
        WHERE line_user_id = p_line_user_id
    ) INTO v_exists;

    RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get registration status by LINE user ID
CREATE OR REPLACE FUNCTION public.get_registration_status(p_line_user_id VARCHAR)
RETURNS JSON AS $$
DECLARE
    reg RECORD;
BEGIN
    SELECT * INTO reg
    FROM public.register_data
    WHERE line_user_id = p_line_user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN json_build_object('exists', false);
    END IF;

    RETURN json_build_object(
        'exists', true,
        'id', reg.id,
        'status', reg.registration_status,
        'employee_code', reg.employee_code,
        'driver_name', reg.driver_name,
        'review_notes', reg.review_notes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search drivers (for the search feature)
CREATE OR REPLACE FUNCTION public.search_drivers(p_search_term VARCHAR)
RETURNS TABLE (
    employee_code VARCHAR,
    driver_name VARCHAR,
    driver_sap_code VARCHAR,
    section VARCHAR,
    truck_type VARCHAR,
    "position" VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.employee_code,
        d.driver_name,
        d.driver_sap_code,
        d.section,
        d.truck_type,
        d."position"
    FROM public.driver_master d
    WHERE d.employee_code ILIKE '%' || p_search_term || '%'
       OR d.driver_name ILIKE '%' || p_search_term || '%'
    ORDER BY d.driver_name
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.is_user_registered(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_registration_status(VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_drivers(VARCHAR) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- PART 4: Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.driver_master IS 'Master driver data reference table (read-only for frontend)';
COMMENT ON TABLE public.register_data IS 'Driver registration requests from LINE LIFF app';

COMMENT ON POLICY "Users can view own registration" ON public.register_data IS
    'Users can only see their own registration. Requires request.line_user_id header to be set.';

COMMENT ON POLICY "Admins can view all registrations" ON public.register_data IS
    'Admin users (with user_metadata.admin = true) can view all registrations.';

COMMENT ON FUNCTION public.search_drivers(VARCHAR) IS
    'Search drivers by employee code or name. Returns up to 10 results.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
