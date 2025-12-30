-- Fix RLS Policies for CRM Pro
-- ========================================
-- Allow public read and insert/update for authenticated users

-- 1. PROFILES TABLE POLICIES
-- ========================================
-- Drop old restrictive policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create new policies
CREATE POLICY "Allow select for all"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow insert for all"
    ON public.profiles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update for all"
    ON public.profiles FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- 2. TIERS TABLE POLICIES
-- ========================================
DROP POLICY IF EXISTS "Tiers are viewable by everyone" ON public.tiers;

CREATE POLICY "Allow select for tiers"
    ON public.tiers FOR SELECT
    USING (true);


-- 3. NEWS PROMOTIONS TABLE POLICIES
-- ========================================
DROP POLICY IF EXISTS "News are viewable by everyone" ON public.news_promotions;

CREATE POLICY "Allow select for news"
    ON public.news_promotions FOR SELECT
    USING (true);

CREATE POLICY "Allow insert for news"
    ON public.news_promotions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update for news"
    ON public.news_promotions FOR UPDATE
    USING (true)
    WITH CHECK (true);


-- 4. CUSTOMER SEGMENTS TABLE POLICIES
-- ========================================
DROP POLICY IF EXISTS "Segments are viewable by everyone" ON public.customer_segments;

CREATE POLICY "Allow select for segments"
    ON public.customer_segments FOR SELECT
    USING (true);

CREATE POLICY "Allow insert for segments"
    ON public.customer_segments FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update for segments"
    ON public.customer_segments FOR UPDATE
    USING (true)
    WITH CHECK (true);
