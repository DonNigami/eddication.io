-- =====================================================
-- Subscription Packages Management System
-- ฟีเจอร์สำหรับให้ลูกค้าสร้างแพคเกจสมาชิกรายปี
-- =====================================================

-- ===== TABLE: subscription_packages =====
-- แพคเกจสมาชิกที่ Admin สร้างขึ้น
CREATE TABLE IF NOT EXISTS subscription_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Package Info
    name TEXT NOT NULL, -- เช่น "Basic", "Silver", "Gold", "Platinum"
    name_en TEXT,
    description TEXT,
    description_en TEXT,
    
    -- Pricing
    price_yearly DECIMAL(10,2) NOT NULL, -- ราคาต่อปี
    currency TEXT DEFAULT 'THB',
    
    -- Benefits
    benefits JSONB DEFAULT '[]', -- ["ส่วนลด 10%", "จัดส่งฟรี", "สะสมแต้มเพิ่ม"]
    
    -- Limits
    max_points INTEGER, -- คะแนนสูงสุดที่สะสมได้
    discount_percent DECIMAL(5,2) DEFAULT 0, -- ส่วนลดเริ่มต้น %
    points_multiplier DECIMAL(5,2) DEFAULT 1, -- เท่าของแต้มที่ได้รับ (1.5 = ได้ 1.5 เท่า)
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    color_theme TEXT DEFAULT '#3B82F6', -- สีประจำแพคเกจ
    icon_url TEXT,
    
    -- PromptPay Settings
    promptpay_phone TEXT DEFAULT '0656987889',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packages_tenant ON subscription_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_packages_active ON subscription_packages(tenant_id, is_active) WHERE is_active = true;

-- ===== TABLE: customer_subscriptions =====
-- การสมัครสมาชิกของลูกค้าปลายทาง
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Customer
    customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    package_id UUID REFERENCES subscription_packages(id),
    
    -- Subscription Period
    status TEXT DEFAULT 'pending', -- pending, active, expired, cancelled
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ, -- วันหมดอายุ (1 ปีหลังจาก start_date)
    
    -- Payment
    payment_method TEXT DEFAULT 'promptpay',
    payment_status TEXT DEFAULT 'pending', -- pending, paid, failed
    paid_amount DECIMAL(10,2),
    paid_at TIMESTAMPTZ,
    payment_slip_url TEXT, -- URL ของสลิปโอนเงิน
    
    -- Omise Charge (if applicable)
    charge_id TEXT,
    charge_status TEXT,
    
    -- Auto Renewal
    auto_renewal BOOLEAN DEFAULT false,
    renewal_reminder_sent BOOLEAN DEFAULT false,
    
    -- Cancellation
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(customer_id, package_id, start_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON customer_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_package ON customer_subscriptions(package_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON customer_subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON customer_subscriptions(end_date) WHERE status = 'active';

-- ===== TABLE: subscription_payments =====
-- ประวัติการชำระเงิน
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
    
    -- Payment Details
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'THB',
    payment_method TEXT DEFAULT 'promptpay', -- promptpay, bank_transfer, cash
    
    -- Status
    status TEXT DEFAULT 'pending', -- pending, verified, rejected
    verified_by UUID REFERENCES tenant_users(id),
    verified_at TIMESTAMPTZ,
    
    -- Evidence
    slip_url TEXT,
    reference_number TEXT,
    
    -- Omise
    charge_id TEXT,
    qr_code_url TEXT,
    
    -- Notes
    notes TEXT,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON subscription_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON subscription_payments(status);

-- ===== TABLE: subscription_renewals =====
-- ประวัติการต่ออายุ
CREATE TABLE IF NOT EXISTS subscription_renewals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
    
    -- Renewal Details
    old_end_date TIMESTAMPTZ NOT NULL,
    new_end_date TIMESTAMPTZ NOT NULL,
    renewed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Payment
    payment_id UUID REFERENCES subscription_payments(id),
    amount_paid DECIMAL(10,2),
    
    -- Type
    renewal_type TEXT DEFAULT 'manual', -- manual, auto, upgrade, downgrade
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_renewals_subscription ON subscription_renewals(subscription_id);

-- ===== UPDATE profiles TABLE =====
-- เพิ่มข้อมูลสมาชิก
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_package_id UUID REFERENCES subscription_packages(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_package ON profiles(current_package_id);
CREATE INDEX IF NOT EXISTS idx_profiles_expiry ON profiles(subscription_expires_at) WHERE is_subscriber = true;

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_renewals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Packages tenant isolation" ON subscription_packages
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Customer subscriptions tenant isolation" ON customer_subscriptions
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

CREATE POLICY "Payments tenant isolation" ON subscription_payments
FOR ALL USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users 
        WHERE email = auth.jwt()->>'email'
    )
);

-- Service role bypass
CREATE POLICY "Service role bypass packages" ON subscription_packages
FOR ALL TO service_role USING (true);

CREATE POLICY "Service role bypass subscriptions" ON customer_subscriptions
FOR ALL TO service_role USING (true);

-- ===== FUNCTIONS =====

-- Function: Check if customer has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription(
    p_customer_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM customer_subscriptions
        WHERE customer_id = p_customer_id
            AND status = 'active'
            AND end_date > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get active package for customer
CREATE OR REPLACE FUNCTION get_customer_package(
    p_customer_id UUID
) RETURNS TABLE (
    package_id UUID,
    package_name TEXT,
    discount_percent DECIMAL,
    points_multiplier DECIMAL,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.name,
        sp.discount_percent,
        sp.points_multiplier,
        cs.end_date
    FROM customer_subscriptions cs
    JOIN subscription_packages sp ON sp.id = cs.package_id
    WHERE cs.customer_id = p_customer_id
        AND cs.status = 'active'
        AND cs.end_date > NOW()
    ORDER BY cs.end_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-expire subscriptions
CREATE OR REPLACE FUNCTION expire_old_subscriptions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE customer_subscriptions
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
        AND end_date < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Update profiles
    UPDATE profiles p
    SET is_subscriber = false,
        current_package_id = NULL,
        subscription_expires_at = NULL
    WHERE is_subscriber = true
        AND NOT EXISTS (
            SELECT 1 FROM customer_subscriptions cs
            WHERE cs.customer_id = p.id
                AND cs.status = 'active'
                AND cs.end_date > NOW()
        );
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== SAMPLE DATA =====
-- Insert sample packages for demo tenant
DO $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'demo' LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO subscription_packages (tenant_id, name, name_en, description, price_yearly, benefits, discount_percent, points_multiplier, color_theme, sort_order)
        VALUES 
            (v_tenant_id, 'สมาชิกทอง', 'Gold Member', 'แพคเกจสมาชิกระดับทอง พร้อมสิทธิพิเศษมากมาย', 999, 
             '["ส่วนลด 5% ทุกครั้ง", "สะสมแต้ม 1.5 เท่า", "จัดส่งฟรีทุกออเดอร์", "วันเกิดรับของขวัญ"]'::jsonb,
             5.00, 1.5, '#FFD700', 1),
             
            (v_tenant_id, 'สมาชิกเพชร', 'Diamond Member', 'แพคเกจสมาชิกระดับเพชร สิทธิพิเศษสูงสุด', 2999,
             '["ส่วนลด 10% ทุกครั้ง", "สะสมแต้ม 2 เท่า", "จัดส่งฟรีแบบด่วน", "ของขวัญวันเกิด VIP", "เข้างานพิเศษก่อนใคร"]'::jsonb,
             10.00, 2.0, '#B9F2FF', 2),
             
            (v_tenant_id, 'สมาชิกเงิน', 'Silver Member', 'แพคเกจสมาชิกระดับเงิน เริ่มต้นสะสมสิทธิ์', 499,
             '["ส่วนลด 3% ทุกครั้ง", "สะสมแต้ม 1.2 เท่า", "จัดส่งฟรีเมื่อซื้อครบ 500฿"]'::jsonb,
             3.00, 1.2, '#C0C0C0', 0)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ===== GRANTS =====
GRANT ALL ON subscription_packages TO service_role;
GRANT ALL ON customer_subscriptions TO service_role;
GRANT ALL ON subscription_payments TO service_role;
GRANT ALL ON subscription_renewals TO service_role;

GRANT SELECT ON subscription_packages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON customer_subscriptions TO authenticated;
GRANT SELECT, INSERT ON subscription_payments TO authenticated;

-- ===== COMMENTS =====
COMMENT ON TABLE subscription_packages IS 'Subscription packages that admins create for their customers';
COMMENT ON TABLE customer_subscriptions IS 'Customer subscriptions to yearly packages';
COMMENT ON TABLE subscription_payments IS 'Payment history for subscriptions';
COMMENT ON TABLE subscription_renewals IS 'Subscription renewal history';
