-- =====================================================
-- Subscription Packages - Standalone Version
-- ไม่ต้องพึ่ง multi-tenant system
-- =====================================================

-- ===== TABLE: subscription_packages =====
CREATE TABLE IF NOT EXISTS subscription_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Package Info
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    
    -- Pricing
    price_yearly DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'THB',
    
    -- Benefits
    benefits JSONB DEFAULT '[]',
    
    -- Limits
    discount_percent DECIMAL(5,2) DEFAULT 0,
    points_multiplier DECIMAL(5,2) DEFAULT 1,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    color_theme TEXT DEFAULT '#3B82F6',
    
    -- PromptPay
    promptpay_phone TEXT DEFAULT '0656987889',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== TABLE: customer_subscriptions =====
CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Customer (line_user_id แทน customer_id)
    line_user_id TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    package_id UUID REFERENCES subscription_packages(id),
    
    -- Subscription Period
    status TEXT DEFAULT 'pending',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Payment
    payment_method TEXT DEFAULT 'promptpay',
    payment_status TEXT DEFAULT 'pending',
    paid_amount DECIMAL(10,2),
    paid_at TIMESTAMPTZ,
    payment_slip_url TEXT,
    charge_id TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== TABLE: subscription_payments =====
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES customer_subscriptions(id),
    
    -- Payment Details
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'promptpay',
    
    -- Status
    status TEXT DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    
    -- Evidence
    slip_url TEXT,
    charge_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_packages_active ON subscription_packages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_line_user ON customer_subscriptions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON subscription_payments(subscription_id);

-- Enable RLS
ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Policies (Allow service role full access)
CREATE POLICY "Service role full access packages" ON subscription_packages
FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access subscriptions" ON customer_subscriptions
FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access payments" ON subscription_payments
FOR ALL TO service_role USING (true);

-- Public can view active packages
CREATE POLICY "Public can view active packages" ON subscription_packages
FOR SELECT USING (is_active = true);

-- ===== SAMPLE DATA =====
INSERT INTO subscription_packages (name, name_en, description, price_yearly, discount_percent, points_multiplier, color_theme, sort_order)
VALUES 
    ('สมาชิกเงิน', 'Silver Member', 'แพคเกจเริ่มต้น', 499, 3.00, 1.2, '#C0C0C0', 0),
    ('สมาชิกทอง', 'Gold Member', 'แพคเกจยอดนิยม', 999, 5.00, 1.5, '#FFD700', 1),
    ('สมาชิกเพชร', 'Diamond Member', 'แพคเกจพรีเมียม', 2999, 10.00, 2.0, '#B9F2FF', 2)
ON CONFLICT DO NOTHING;

-- Add benefits for packages
UPDATE subscription_packages SET benefits = '["ส่วนลด 3% ทุกครั้ง", "สะสมแต้ม 1.2 เท่า", "จัดส่งฟรีเมื่อซื้อครบ 500฿"]'::jsonb WHERE name = 'สมาชิกเงิน';
UPDATE subscription_packages SET benefits = '["ส่วนลด 5% ทุกครั้ง", "สะสมแต้ม 1.5 เท่า", "จัดส่งฟรีทุกออเดอร์", "วันเกิดรับของขวัญ"]'::jsonb WHERE name = 'สมาชิกทอง';
UPDATE subscription_packages SET benefits = '["ส่วนลด 10% ทุกครั้ง", "สะสมแต้ม 2 เท่า", "จัดส่งฟรีแบบด่วน", "ของขวัญวันเกิด VIP", "เข้างานพิเศษก่อนใคร", "บริการส่วนตัว"]'::jsonb WHERE name = 'สมาชิกเพชร';
