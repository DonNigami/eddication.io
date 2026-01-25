-- =====================================================
-- Migration: Add Driver Approval System
-- =====================================================
-- This migration adds fields to track driver approval status
-- and enforces the approval check in the application layer.
--
-- Driver app checks: currentUserProfile?.status !== 'APPROVED'
-- =====================================================

-- =====================================================
-- 1. Add approval tracking fields to user_profiles
-- =====================================================

-- Add approved_by (LINE User ID of admin who approved)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Add approved_at timestamp
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add rejection reason (in case of rejection)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Update status column to include approved/pending/rejected
-- Existing 'active' users will be set to 'APPROVED'
-- Existing users with other status will be set to 'PENDING'
UPDATE public.user_profiles
SET status = CASE
    WHEN status IN ('active', 'APPROVED') THEN 'APPROVED'
    ELSE 'PENDING'
END
WHERE status IS NULL OR status NOT IN ('APPROVED', 'PENDING', 'REJECTED');

-- =====================================================
-- 2. Add comment documentation
-- =====================================================

COMMENT ON COLUMN public.user_profiles.status IS
'Driver approval status: APPROVED, PENDING, or REJECTED';

COMMENT ON COLUMN public.user_profiles.approved_by IS
'LINE User ID of the admin who approved this driver';

COMMENT ON COLUMN public.user_profiles.approved_at IS
'Timestamp when the driver was approved';

COMMENT ON COLUMN public.user_profiles.rejection_reason IS
'Reason for rejection (if status = REJECTED)';

-- =====================================================
-- 3. Add index for admin approval queries
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_status_approval
    ON public.user_profiles(status, approved_at DESC);

-- =====================================================
-- 4. Create function to check if user is approved
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_user_approved(p_user_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE user_id = p_user_id
        AND status = 'APPROVED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Create view for pending approvals (admin use)
-- =====================================================
CREATE OR REPLACE VIEW public.pending_driver_approvals AS
SELECT
    id,
    user_id,
    display_name,
    picture_url,
    phone,
    email,
    employee_id,
    user_type,
    first_seen_at,
    last_seen_at,
    total_visits
FROM public.user_profiles
WHERE status = 'PENDING'
ORDER BY first_seen_at ASC;

COMMENT ON VIEW public.pending_driver_approvals IS
'View for admin to see drivers pending approval';

-- =====================================================
-- 6. Verification
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Driver approval system migration completed';
    RAISE NOTICE 'Existing users set to APPROVED if status was active';
END $$;

-- Show current status distribution
SELECT
    status,
    COUNT(*) as count
FROM public.user_profiles
GROUP BY status
ORDER BY status;
