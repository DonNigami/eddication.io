-- ================================================================
-- Fix RLS Policies for Admin Panel (packages-admin.html)
-- Allow anon key to access subscription-related tables
-- ================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Customer subscriptions tenant isolation" ON customer_subscriptions;
DROP POLICY IF EXISTS "Packages tenant isolation" ON subscription_packages;
DROP POLICY IF EXISTS "Payments tenant isolation" ON subscription_payments;

-- Create new policies that allow anon access for admin operations
-- (In production, you'd use authenticated users with proper auth)

-- subscription_packages policies
CREATE POLICY "Public read packages" ON subscription_packages
    FOR SELECT USING (is_active = true OR true);  -- Allow all for now

CREATE POLICY "Anon write packages" ON subscription_packages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon update packages" ON subscription_packages
    FOR UPDATE USING (true);

-- customer_subscriptions policies
CREATE POLICY "Public read subscriptions" ON customer_subscriptions
    FOR SELECT USING (true);  -- Allow all anon reads

CREATE POLICY "Anon create subscriptions" ON customer_subscriptions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon update subscriptions" ON customer_subscriptions
    FOR UPDATE USING (true);

-- subscription_payments policies (if exists)
DROP POLICY IF EXISTS "Payments tenant isolation" ON subscription_payments;

CREATE POLICY "Public read payments" ON subscription_payments
    FOR SELECT USING (true);

CREATE POLICY "Anon write payments" ON subscription_payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon update payments" ON subscription_payments
    FOR UPDATE USING (true);

-- subscription_requests policies (if not exists, create table)
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

ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read requests" ON subscription_requests
    FOR SELECT USING (true);

CREATE POLICY "Anon create requests" ON subscription_requests
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon update requests" ON subscription_requests
    FOR UPDATE USING (true);

-- profiles table - allow anon to read/create customers
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

CREATE POLICY "Public read profiles" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Anon create profiles" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon update profiles" ON profiles
    FOR UPDATE USING (true);

-- payments table policies
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    slip_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read payments" ON payments
    FOR SELECT USING (true);

CREATE POLICY "Anon write payments" ON payments
    FOR INSERT WITH CHECK (true);

-- subscriptions_packages table - make sure it exists and is accessible
CREATE TABLE IF NOT EXISTS subscriptions_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    price_yearly DECIMAL(10,2),
    discount_percent DECIMAL(5,2) DEFAULT 0,
    points_multiplier DECIMAL(5,2) DEFAULT 1,
    color_theme TEXT,
    promptpay_phone TEXT,
    benefits TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read packages full" ON subscriptions_packages
    FOR SELECT USING (true);

CREATE POLICY "Anon create packages" ON subscriptions_packages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon update packages" ON subscriptions_packages
    FOR UPDATE USING (true);

-- Done
NOTIFY pgrst, 'reload schema';
