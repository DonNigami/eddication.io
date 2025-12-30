-- =====================================================
-- CRM Pro - Multi-Tenant SaaS Schema
-- =====================================================
-- Version: 3.0.0
-- Date: 2025-12-30
-- Features: Multi-tenant, Subscriptions, Usage Tracking
-- =====================================================

-- ===== TABLE: tenants =====
-- Core tenant (organization) table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- subdomain: acme.yourcrm.com
    plan TEXT DEFAULT 'free', -- free, starter, pro, enterprise
    status TEXT DEFAULT 'active', -- active, trial, suspended, cancelled
    max_users INTEGER DEFAULT 2,
    max_customers INTEGER DEFAULT 500,
    max_broadcasts_per_month INTEGER DEFAULT 1000,
    features JSONB DEFAULT '["basic_crm", "line_integration", "manual_broadcasts"]',
    
    -- Branding
    logo_url TEXT,
    primary_color TEXT DEFAULT '#06C755',
    custom_domain TEXT,
    
    -- Billing
    billing_email TEXT,
    billing_address JSONB,
    tax_id TEXT,
    
    -- Subscription
    subscription_id UUID,
    trial_ends_at TIMESTAMPTZ,
    subscription_started_at TIMESTAMPTZ,
    
    -- Metadata
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

-- ===== TABLE: tenant_users =====
-- Users who can access tenant dashboard
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    password_hash TEXT, -- for auth
    display_name TEXT,
    role TEXT DEFAULT 'member', -- owner, admin, manager, member
    permissions JSONB DEFAULT '[]', -- granular permissions
    avatar_url TEXT,
    
    -- Status
    status TEXT DEFAULT 'active', -- active, invited, suspended
    invited_by UUID REFERENCES tenant_users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    -- Settings
    notification_preferences JSONB DEFAULT '{"email": true, "push": true}',
    timezone TEXT DEFAULT 'Asia/Bangkok',
    language TEXT DEFAULT 'th',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(tenant_id, role);

-- ===== TABLE: subscriptions =====
-- Subscription management
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) UNIQUE,
    plan TEXT NOT NULL, -- free, starter, pro, enterprise
    status TEXT DEFAULT 'active', -- active, trialing, past_due, cancelled, paused
    
    -- Billing cycle
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Payment
    payment_method JSONB, -- {type: 'card', last4: '4242', brand: 'visa'}
    payment_provider TEXT DEFAULT 'omise', -- omise, stripe, manual
    payment_provider_customer_id TEXT,
    payment_provider_subscription_id TEXT,
    
    -- Pricing
    price_per_month DECIMAL(10,2),
    currency TEXT DEFAULT 'THB',
    
    -- Dates
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ,
    next_payment_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment ON subscriptions(next_payment_date);

-- ===== TABLE: invoices =====
-- Invoice history
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    subscription_id UUID REFERENCES subscriptions(id),
    
    -- Invoice details
    invoice_number TEXT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'THB',
    
    -- Status
    status TEXT DEFAULT 'draft', -- draft, open, paid, void, uncollectible
    paid_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    
    -- Payment
    payment_method TEXT,
    payment_intent_id TEXT,
    
    -- Line items
    items JSONB, -- [{description, quantity, unit_price, amount}]
    
    -- Files
    invoice_pdf_url TEXT,
    receipt_pdf_url TEXT,
    
    -- Metadata
    notes TEXT,
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ===== TABLE: usage_metrics =====
-- Track usage for billing and limits
CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    
    -- Metric details
    metric_type TEXT NOT NULL, -- broadcasts_sent, api_calls, storage_gb, customers_count
    metric_value INTEGER NOT NULL,
    
    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    metadata JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usage_tenant_type ON usage_metrics(tenant_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage_metrics(tenant_id, period_start, period_end);

-- ===== TABLE: payment_methods =====
-- Stored payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    
    -- Payment method details
    type TEXT NOT NULL, -- card, bank_account, promptpay
    provider TEXT NOT NULL, -- omise, stripe
    provider_payment_method_id TEXT NOT NULL,
    
    -- Card details (if applicable)
    card_brand TEXT, -- visa, mastercard
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_holder_name TEXT,
    
    -- Bank details (if applicable)
    bank_name TEXT,
    bank_account_last4 TEXT,
    
    -- Status
    is_default BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active', -- active, expired, failed
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(tenant_id, is_default) WHERE is_default = true;

-- ===== UPDATE profiles TABLE =====
-- Add tenant_id to existing profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);

-- ===== UPDATE other tables =====
ALTER TABLE customer_segments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE tiers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE news_promotions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE transaction_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_segments_tenant ON customer_segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tiers_tenant ON tiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_news_tenant ON news_promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transaction_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);

-- ===== ROW LEVEL SECURITY =====
-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY "Tenant isolation" ON tenants
FOR ALL USING (
    id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Tenant users isolation" ON tenant_users
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Profiles tenant isolation" ON profiles
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Similar policies for other tables
CREATE POLICY "Segments tenant isolation" ON customer_segments
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Subscriptions tenant isolation" ON subscriptions
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Invoices tenant isolation" ON invoices
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Service role bypasses RLS
CREATE POLICY "Service role bypass" ON tenants
FOR ALL TO service_role
USING (true);

-- ===== FUNCTIONS =====

-- Function to get current tenant from JWT
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check plan limits
CREATE OR REPLACE FUNCTION check_plan_limit(
    p_tenant_id UUID,
    p_limit_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_plan TEXT;
    v_current_count INTEGER;
    v_max_allowed INTEGER;
BEGIN
    -- Get tenant plan
    SELECT plan INTO v_plan FROM tenants WHERE id = p_tenant_id;
    
    -- Check specific limit
    CASE p_limit_type
        WHEN 'customers' THEN
            SELECT COUNT(*) INTO v_current_count FROM profiles WHERE tenant_id = p_tenant_id;
            SELECT max_customers INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
            
        WHEN 'users' THEN
            SELECT COUNT(*) INTO v_current_count FROM tenant_users WHERE tenant_id = p_tenant_id;
            SELECT max_users INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
            
        WHEN 'broadcasts_monthly' THEN
            SELECT COALESCE(SUM(metric_value), 0) INTO v_current_count
            FROM usage_metrics
            WHERE tenant_id = p_tenant_id
                AND metric_type = 'broadcasts_sent'
                AND period_start >= DATE_TRUNC('month', NOW());
            SELECT max_broadcasts_per_month INTO v_max_allowed FROM tenants WHERE id = p_tenant_id;
    END CASE;
    
    RETURN v_current_count < v_max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage
CREATE OR REPLACE FUNCTION record_usage(
    p_tenant_id UUID,
    p_metric_type TEXT,
    p_metric_value INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
    INSERT INTO usage_metrics (tenant_id, metric_type, metric_value, period_start, period_end)
    VALUES (
        p_tenant_id,
        p_metric_type,
        p_metric_value,
        DATE_TRUNC('month', NOW()),
        (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')
    )
    ON CONFLICT (tenant_id, metric_type, period_start) 
    DO UPDATE SET metric_value = usage_metrics.metric_value + p_metric_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== SAMPLE DATA =====
-- Insert sample tenant (for testing)
INSERT INTO tenants (name, slug, plan, status, billing_email)
VALUES 
    ('Demo Company', 'demo', 'free', 'active', 'demo@example.com'),
    ('Acme Corp', 'acme', 'starter', 'trial', 'billing@acme.com')
ON CONFLICT (slug) DO NOTHING;

-- Insert sample tenant user
INSERT INTO tenant_users (tenant_id, email, display_name, role)
SELECT id, 'admin@demo.com', 'Demo Admin', 'owner'
FROM tenants WHERE slug = 'demo'
ON CONFLICT (tenant_id, email) DO NOTHING;

-- ===== GRANTS =====
GRANT ALL ON tenants TO service_role;
GRANT ALL ON tenant_users TO service_role;
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON invoices TO service_role;
GRANT ALL ON usage_metrics TO service_role;
GRANT ALL ON payment_methods TO service_role;

GRANT SELECT ON tenants TO authenticated;
GRANT SELECT ON tenant_users TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON invoices TO authenticated;

-- ===== COMMENTS =====
COMMENT ON TABLE tenants IS 'Multi-tenant organizations';
COMMENT ON TABLE tenant_users IS 'Users who can access tenant dashboard';
COMMENT ON TABLE subscriptions IS 'Subscription plans and billing';
COMMENT ON TABLE invoices IS 'Invoice history and receipts';
COMMENT ON TABLE usage_metrics IS 'Track usage for billing and limits';
COMMENT ON TABLE payment_methods IS 'Stored payment methods';
