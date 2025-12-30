-- =====================================================
-- CRM Pro - Database Schema for New Features
-- =====================================================
-- Version: 2.0.0
-- Date: 2025-12-30
-- Features: Transaction History, Audit Logs
-- =====================================================

-- ===== TABLE: transaction_history =====
-- Logs all points transactions for audit and tracking
CREATE TABLE IF NOT EXISTS transaction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    points_change INTEGER NOT NULL,
    points_before INTEGER NOT NULL,
    points_after INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'manual_adjustment', 'purchase', 'reward', 'refund'
    reason TEXT,
    created_by TEXT, -- Admin user ID or 'system'
    request_id TEXT, -- Correlation ID for debugging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB -- Additional context (e.g., order_id, promotion_id)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_transaction_history_user_id 
ON transaction_history(user_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_transaction_history_created_at 
ON transaction_history(created_at DESC);

-- Index for admin tracking
CREATE INDEX IF NOT EXISTS idx_transaction_history_created_by 
ON transaction_history(created_by);

-- Enable Row Level Security
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view all transactions
CREATE POLICY "Admin can view all transactions" 
ON transaction_history FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.line_user_id = auth.uid()::text 
        AND profiles.is_admin = true
    )
);

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions" 
ON transaction_history FOR SELECT 
USING (user_id = auth.uid()::text);

-- Policy: Service role can insert transactions
CREATE POLICY "Service role can insert transactions" 
ON transaction_history FOR INSERT 
WITH CHECK (true);

-- ===== TABLE: audit_logs =====
-- Logs all admin actions for security and compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL, -- 'broadcast', 'update_customer', 'create_segment', 'delete_news'
    actor_id TEXT NOT NULL, -- Admin user ID or 'system'
    target_type TEXT, -- 'all', 'segment:xxx', 'tag:xxx'
    target_count INTEGER, -- Number of users affected
    message_type TEXT, -- 'text', 'image', 'flex'
    success_count INTEGER, -- For broadcast actions
    failed_count INTEGER, -- For broadcast actions
    metadata JSONB, -- Additional context (message preview, filters, etc.)
    request_id TEXT, -- Correlation ID for debugging
    ip_address TEXT, -- Client IP for security
    user_agent TEXT, -- Browser/app info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for actor lookup
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id 
ON audit_logs(actor_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON audit_logs(created_at DESC);

-- Index for action type filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(action);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs
CREATE POLICY "Admin can view audit logs" 
ON audit_logs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.line_user_id = auth.uid()::text 
        AND profiles.is_admin = true
    )
);

-- Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" 
ON audit_logs FOR INSERT 
WITH CHECK (true);

-- ===== HELPFUL QUERIES =====

-- Query 1: View recent transactions for a user
COMMENT ON TABLE transaction_history IS 
'Example query: SELECT * FROM transaction_history WHERE user_id = ''U1234567890abcdef'' ORDER BY created_at DESC LIMIT 10;';

-- Query 2: View admin activity report
COMMENT ON TABLE audit_logs IS 
'Example query: SELECT actor_id, action, COUNT(*) as count FROM audit_logs WHERE created_at > NOW() - INTERVAL ''7 days'' GROUP BY actor_id, action ORDER BY count DESC;';

-- Query 3: View user points balance report
-- SELECT 
--     user_id,
--     SUM(points_change) as total_points_earned,
--     COUNT(*) as transaction_count
-- FROM transaction_history
-- GROUP BY user_id
-- ORDER BY total_points_earned DESC
-- LIMIT 10;

-- ===== GRANTS =====
-- Grant service role full access
GRANT ALL ON transaction_history TO service_role;
GRANT ALL ON audit_logs TO service_role;

-- Grant authenticated users read access (via RLS policies)
GRANT SELECT ON transaction_history TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
