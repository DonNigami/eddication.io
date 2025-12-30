-- =====================================================
-- COMPLETE SETUP FOR SUBSCRIPTION SYSTEM
-- Copy & run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Create all required tables
-- =====================================================

CREATE TABLE IF NOT EXISTS subscription_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    price_yearly DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'THB',
    benefits JSONB DEFAULT '[]',
    discount_percent DECIMAL(5,2) DEFAULT 0,
    points_multiplier DECIMAL(5,2) DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    color_theme TEXT DEFAULT '#3B82F6',
    promptpay_phone TEXT DEFAULT '0656987889',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    package_id UUID REFERENCES subscription_packages(id),
    status TEXT DEFAULT 'pending',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    payment_method TEXT DEFAULT 'promptpay',
    payment_status TEXT DEFAULT 'pending',
    paid_amount DECIMAL(10,2),
    paid_at TIMESTAMPTZ,
    payment_slip_url TEXT,
    charge_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES customer_subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'promptpay',
    status TEXT DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    slip_url TEXT,
    charge_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    package_name TEXT NOT NULL,
    duration_months INTEGER DEFAULT 12,
    total_price DECIMAL(10,2),
    slip_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    slip_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove package_name column if it exists (from old schema)
DO $$ 
BEGIN
    ALTER TABLE payments DROP COLUMN IF EXISTS package_name;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id TEXT UNIQUE,
    display_name TEXT,
    picture_url TEXT,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    tags TEXT[] DEFAULT '{}',
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_packages_active ON subscription_packages(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_packages_sort ON subscription_packages(sort_order);
CREATE INDEX IF NOT EXISTS idx_subscriptions_line_user ON customer_subscriptions(line_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_package ON customer_subscriptions(package_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_name ON customer_subscriptions(customer_name);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON subscription_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_customer ON subscription_requests(customer_phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Step 3: Enable RLS
-- =====================================================

ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies (safe drop)
-- =====================================================

DO $$ 
BEGIN
    -- Drop old tenant isolation policies
    DROP POLICY IF EXISTS "Packages tenant isolation" ON subscription_packages;
    DROP POLICY IF EXISTS "Customer subscriptions tenant isolation" ON customer_subscriptions;
    DROP POLICY IF EXISTS "Payments tenant isolation" ON subscription_payments;
    DROP POLICY IF EXISTS "Service role bypass packages" ON subscription_packages;
    DROP POLICY IF EXISTS "Service role bypass subscriptions" ON customer_subscriptions;
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
    
    -- Drop anon policies if they exist
    DROP POLICY IF EXISTS "subscription_packages anon" ON subscription_packages;
    DROP POLICY IF EXISTS "customer_subscriptions anon" ON customer_subscriptions;
    DROP POLICY IF EXISTS "subscription_payments anon" ON subscription_payments;
    DROP POLICY IF EXISTS "subscription_requests anon" ON subscription_requests;
    DROP POLICY IF EXISTS "payments anon" ON payments;
    DROP POLICY IF EXISTS "profiles anon" ON profiles;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors if policies don't exist
END $$;

-- Step 5: Create new anon-friendly policies
-- =====================================================

CREATE POLICY "subscription_packages anon" ON subscription_packages
    FOR ALL USING (true);

CREATE POLICY "customer_subscriptions anon" ON customer_subscriptions
    FOR ALL USING (true);

CREATE POLICY "subscription_payments anon" ON subscription_payments
    FOR ALL USING (true);

CREATE POLICY "subscription_requests anon" ON subscription_requests
    FOR ALL USING (true);

CREATE POLICY "payments anon" ON payments
    FOR ALL USING (true);

CREATE POLICY "profiles anon" ON profiles
    FOR ALL USING (true);

-- Step 6: Delete old data and insert fresh package data
-- =====================================================

-- Delete existing packages to avoid conflicts
DELETE FROM subscription_packages;

-- Insert packages with both Thai and English names
INSERT INTO subscription_packages (name, name_en, description, price_yearly, color_theme, benefits, discount_percent, points_multiplier, is_active, sort_order)
VALUES 
    ('Silver', 'Silver', 'สมาชิกเงิน - ส่วนลด 5%', 999, '#C0C0C0', '["ส่วนลด 5%", "สะสมแต้ม 1x", "บริการพื้นฐาน"]', 5.00, 1.0, true, 1),
    ('Gold', 'Gold', 'สมาชิกทอง - ส่วนลด 10%', 1999, '#FFD700', '["ส่วนลด 10%", "สะสมแต้ม 1.5x", "ส่งฟรีทั่วประเทศ", "สิทธิพิเศษ"]', 10.00, 1.5, true, 2),
    ('Platinum', 'Platinum', 'สมาชิกแพลทินัม - ส่วนลด 15%', 3999, '#E5E4E2', '["ส่วนลด 15%", "สะสมแต้ม 2x", "ส่งฟรี + Priority", "บริการ VIP"]', 15.00, 2.0, true, 3);

-- SUCCESS!
SELECT 'Setup complete! All tables created with sample packages: Silver, Gold, Platinum' AS result;
