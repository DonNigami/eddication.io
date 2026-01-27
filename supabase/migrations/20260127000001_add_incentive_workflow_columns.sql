-- Migration: Add Incentive Workflow Columns
-- Description: Adds columns for the new incentive approval and payment workflow
-- Replaces the old holiday_work approval system with a more comprehensive incentive system

-- Add incentive approval columns to jobdata table
ALTER TABLE jobdata
ADD COLUMN IF NOT EXISTS incentive_approved BOOLEAN,
ADD COLUMN IF NOT EXISTS incentive_approved_by TEXT,
ADD COLUMN IF NOT EXISTS incentive_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS incentive_distance NUMERIC,
ADD COLUMN IF NOT EXISTS incentive_stops INTEGER,
ADD COLUMN IF NOT EXISTS incentive_rate NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS incentive_amount NUMERIC,
ADD COLUMN IF NOT EXISTS incentive_notes TEXT;

-- Add payment status columns
ALTER TABLE jobdata
ADD COLUMN IF NOT EXISTS payment_status TEXT,
    ADD CONSTRAINT check_payment_status
    CHECK (payment_status IN ('pending', 'processing', 'paid', 'transfer_pending', 'correction_needed', 'rejected') OR payment_status IS NULL);

ALTER TABLE jobdata
ADD COLUMN IF NOT EXISTS payment_notes TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_by TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobdata_incentive_approved ON jobdata(incentive_approved) WHERE incentive_approved IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobdata_payment_status ON jobdata(payment_status) WHERE payment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobdata_incentive_approved_at ON jobdata(incentive_approved_at DESC) WHERE incentive_approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobdata_paid_at ON jobdata(paid_at DESC) WHERE paid_at IS NOT NULL;

-- Add comment to document the incentive workflow
COMMENT ON COLUMN jobdata.incentive_approved IS 'TRUE if the trip incentive has been verified and approved for payment';
COMMENT ON COLUMN jobdata.incentive_approved_by IS 'LINE User ID of the admin who approved the incentive';
COMMENT ON COLUMN jobdata.incentive_approved_at IS 'Timestamp when the incentive was approved';
COMMENT ON COLUMN jobdata.incentive_distance IS 'Total distance in km for incentive calculation';
COMMENT ON COLUMN jobdata.incentive_stops IS 'Number of delivery stops for incentive calculation';
COMMENT ON COLUMN jobdata.incentive_rate IS 'Incentive rate per km in THB';
COMMENT ON COLUMN jobdata.incentive_amount IS 'Total incentive amount in THB';
COMMENT ON COLUMN jobdata.incentive_notes IS 'Notes related to incentive calculation or approval';
COMMENT ON COLUMN jobdata.payment_status IS 'Payment status: pending, processing, paid, transfer_pending, correction_needed, rejected';
COMMENT ON COLUMN jobdata.payment_notes IS 'Notes related to payment processing';
COMMENT ON COLUMN jobdata.paid_at IS 'Timestamp when payment was marked as complete';
COMMENT ON COLUMN jobdata.paid_by IS 'LINE User ID of the admin who marked as paid';

-- Migrate existing holiday_work_approved data to incentive_approved
UPDATE jobdata
SET
    incentive_approved = holiday_work_approved,
    incentive_approved_by = holiday_work_approved_by,
    incentive_approved_at = holiday_work_approved_at,
    incentive_notes = holiday_work_notes
WHERE holiday_work_approved IS NOT NULL;

-- Add helpful comments for the workflow process
COMMENT ON TABLE jobdata IS '
Driver job data with incentive workflow:

Workflow States:
1. Trip Completed (job_closed_at IS NOT NULL)
   ↓
2. Pending Verification (incentive_approved IS NULL)
   Admin verifies trip details, distance, stops
   ↓
3. Approved (incentive_approved = TRUE)
   Moves to Payment Processing queue
   ↓
4. Payment Processing (payment_status = processing/transfer_pending)
   Accounting team processes payment
   ↓
5. Paid (payment_status = paid, paid_at IS NOT NULL)

Alternative paths:
- Request Correction (payment_status = correction_needed)
- Rejected (incentive_approved = FALSE)
';

-- Grant necessary permissions (adjust based on your security model)
-- These are basic grants - adjust according to your RLS policies
-- GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- GRANT INSERT, UPDATE ON TABLE jobdata TO authenticated, service_role;
