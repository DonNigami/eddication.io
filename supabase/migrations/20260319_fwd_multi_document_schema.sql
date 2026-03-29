-- FWD Multi-Document OCR System Schema
-- Supports: fuel_receipt, tax_invoice, travel_doc, odometer
-- Includes: validation, workflow, analytics

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ MAIN DOCUMENTS TABLE ============
CREATE TABLE IF NOT EXISTS fwd_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User identification
    user_id UUID NOT NULL,
    line_user_id TEXT, -- LINE User ID (different from auth.users.id)

    -- Document classification
    document_type TEXT NOT NULL CHECK (document_type IN ('fuel_receipt', 'tax_invoice', 'travel_doc', 'odometer')),

    -- Extracted data (JSONB for flexibility)
    raw_data JSONB NOT NULL,

    -- Image storage
    image_url TEXT,
    image_hash TEXT, -- SHA-256 hash for duplicate detection

    -- AI processing metadata
    confidence_score NUMERIC(3,2), -- 0.00 to 1.00
    ai_provider TEXT CHECK (ai_provider IN ('gemini', 'openai')),
    ocr_raw_text TEXT,

    -- Validation results
    is_valid BOOLEAN DEFAULT true,
    validation_flags JSONB DEFAULT '[]'::jsonb,

    -- Workflow status
    workflow_status TEXT DEFAULT 'pending' CHECK (workflow_status IN ('pending', 'manager_review', 'finance_review', 'approved', 'rejected', 'cancelled')),
    requires_approval BOOLEAN DEFAULT false,

    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_fwd_documents_user ON fwd_documents(user_id, submitted_at DESC);
CREATE INDEX idx_fwd_documents_type ON fwd_documents(document_type, submitted_at DESC);
CREATE INDEX idx_fwd_documents_workflow ON fwd_documents(workflow_status, requires_approval);
CREATE INDEX idx_fwd_documents_image_hash ON fwd_documents(image_hash) WHERE image_hash IS NOT NULL;
CREATE INDEX idx_fwd_documents_line_user ON fwd_documents(line_user_id, submitted_at DESC);

-- ============ APPROVAL WORKFLOWS TABLE ============
CREATE TABLE IF NOT EXISTS fwd_approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES fwd_documents(id) ON DELETE CASCADE,

    -- Workflow state
    current_step TEXT NOT NULL CHECK (current_step IN ('pending', 'manager_review', 'finance_review', 'approved', 'rejected')),

    -- People involved
    submitted_by UUID NOT NULL,
    current_approver UUID,

    -- Comments and feedback
    comments JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one workflow per document
    UNIQUE(document_id)
);

CREATE INDEX idx_fwd_approval_workflows_document ON fwd_approval_workflows(document_id);
CREATE INDEX idx_fwd_approval_workflows_approver ON fwd_approval_workflows(current_approver, current_step);

-- ============ APPROVAL HISTORY TABLE ============
CREATE TABLE IF NOT EXISTS fwd_approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES fwd_approval_workflows(id) ON DELETE CASCADE,

    -- Approval action
    approver_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'returned')),
    comment TEXT,

    -- Timestamp
    acted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fwd_approval_history_workflow ON fwd_approval_history(workflow_id, acted_at DESC);

-- ============ ANALYTICS SUMMARY TABLE ============
CREATE TABLE IF NOT EXISTS fwd_document_summary (
    user_id UUID NOT NULL,
    month DATE NOT NULL, -- First day of month
    document_type TEXT NOT NULL,

    -- Aggregated metrics
    total_amount NUMERIC DEFAULT 0,
    total_count BIGINT DEFAULT 0,
    avg_confidence NUMERIC(3,2),

    -- Approval metrics
    approved_count BIGINT DEFAULT 0,
    rejected_count BIGINT DEFAULT 0,
    pending_count BIGINT DEFAULT 0,

    -- Validation metrics
    valid_count BIGINT DEFAULT 0,
    invalid_count BIGINT DEFAULT 0,

    PRIMARY KEY (user_id, month, document_type)
);

-- Index for analytics queries
CREATE INDEX idx_fwd_document_summary_user ON fwd_document_summary(user_id, month DESC);
CREATE INDEX idx_fwd_document_summary_type ON fwd_document_summary(document_type, month DESC);

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE fwd_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents
CREATE POLICY "Users can view own fwd_documents"
    ON fwd_documents FOR SELECT
    USING (
        user_id = auth.uid() OR
        line_user_id IN (SELECT line_user_id FROM fwd_document_users WHERE user_id = auth.uid())
    );

-- Users can insert their own documents
CREATE POLICY "Users can insert fwd_documents"
    ON fwd_documents FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own documents (if not yet approved)
CREATE POLICY "Users can update own pending fwd_documents"
    ON fwd_documents FOR UPDATE
    USING (
        user_id = auth.uid() AND
        workflow_status IN ('pending', 'rejected')
    );

-- Enable RLS on workflow tables
ALTER TABLE fwd_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE fwd_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fwd_document_summary ENABLE ROW LEVEL SECURITY;

-- ============ FUNCTIONS AND TRIGGERS ============

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION fwd_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER fwd_documents_updated_at
    BEFORE UPDATE ON fwd_documents
    FOR EACH ROW
    EXECUTE FUNCTION fwd_update_updated_at();

CREATE TRIGGER fwd_approval_workflows_updated_at
    BEFORE UPDATE ON fwd_approval_workflows
    FOR EACH ROW
    EXECUTE FUNCTION fwd_update_updated_at();

-- Function to update document summary (called manually or via cron)
CREATE OR REPLACE FUNCTION fwd_update_document_summary(
    p_user_id UUID,
    p_month DATE
) RETURNS void AS $$
BEGIN
    INSERT INTO fwd_document_summary (
        user_id,
        month,
        document_type,
        total_amount,
        total_count,
        avg_confidence,
        approved_count,
        rejected_count,
        pending_count,
        valid_count,
        invalid_count
    )
    SELECT
        p_user_id,
        p_month,
        document_type,
        COALESCE(SUM((raw_data->>'total_amount')::NUMERIC), 0),
        COUNT(*),
        COALESCE(AVG(confidence_score), 0),
        COUNT(*) FILTER (WHERE workflow_status = 'approved'),
        COUNT(*) FILTER (WHERE workflow_status = 'rejected'),
        COUNT(*) FILTER (WHERE workflow_status IN ('pending', 'manager_review', 'finance_review')),
        COUNT(*) FILTER (WHERE is_valid = true),
        COUNT(*) FILTER (WHERE is_valid = false)
    FROM fwd_documents
    WHERE
        user_id = p_user_id AND
        date_trunc('month', submitted_at) = p_month
    GROUP BY document_type
    ON CONFLICT (user_id, month, document_type)
    DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        total_count = EXCLUDED.total_count,
        avg_confidence = EXCLUDED.avg_confidence,
        approved_count = EXCLUDED.approved_count,
        rejected_count = EXCLUDED.rejected_count,
        pending_count = EXCLUDED.pending_count,
        valid_count = EXCLUDED.valid_count,
        invalid_count = EXCLUDED.invalid_count;
END;
$$ LANGUAGE plpgsql;

-- ============ LINE USER MAPPING TABLE (Optional) ============
-- Maps LINE User IDs to internal user IDs
CREATE TABLE IF NOT EXISTS fwd_document_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Internal user ID
    line_user_id TEXT UNIQUE NOT NULL, -- LINE User ID
    line_display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fwd_document_users_user ON fwd_document_users(user_id);
CREATE INDEX idx_fwd_document_users_line ON fwd_document_users(line_user_id);

ALTER TABLE fwd_document_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fwd_document_users"
    ON fwd_document_users FOR SELECT
    USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER fwd_document_users_updated_at
    BEFORE UPDATE ON fwd_document_users
    FOR EACH ROW
    EXECUTE FUNCTION fwd_update_updated_at();

-- ============ STORAGE BUCKET (if not exists) ============
-- Note: This requires supabase/storage extension
-- Run this manually in Supabase dashboard if needed:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fwd-documents', 'fwd-documents', false);

-- ============ GRANT PERMISSIONS ============
-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON fwd_documents TO authenticated;
GRANT ALL ON fwd_approval_workflows TO authenticated;
GRANT ALL ON fwd_approval_history TO authenticated;
GRANT ALL ON fwd_document_summary TO authenticated;
GRANT ALL ON fwd_document_users TO authenticated;
GRANT EXECUTE ON FUNCTION fwd_update_document_summary TO authenticated;

-- ============ COMMENTS FOR DOCUMENTATION ============
COMMENT ON TABLE fwd_documents IS 'Stores all processed documents from FWD OCR system';
COMMENT ON TABLE fwd_approval_workflows IS 'Tracks approval workflow state for documents requiring approval';
COMMENT ON TABLE fwd_approval_history IS 'Historical record of all approval actions';
COMMENT ON TABLE fwd_document_summary IS 'Aggregated analytics data for reporting';
COMMENT ON TABLE fwd_document_users IS 'Maps LINE User IDs to internal user IDs';

COMMENT ON COLUMN fwd_documents.raw_data IS 'Full extracted data as JSONB';
COMMENT ON COLUMN fwd_documents.validation_flags IS 'Array of validation warnings/errors';
COMMENT ON COLUMN fwd_documents.workflow_status IS 'Current workflow state: pending, manager_review, finance_review, approved, rejected, cancelled';
COMMENT ON COLUMN fwd_documents.requires_approval IS 'Whether document requires approval workflow (based on document type)';
