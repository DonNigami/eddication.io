-- Fix RLS Policies for CRM Pro
-- ========================================
-- Allow public read and insert/update for authenticated users

-- 1. PROFILES TABLE POLICIES
-- ========================================
-- Drop old restrictive policies (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
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
  END IF;
END $$;


-- 2. TIERS TABLE POLICIES
-- ========================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tiers') THEN
    DROP POLICY IF EXISTS "Tiers are viewable by everyone" ON public.tiers;

    CREATE POLICY "Allow select for tiers"
        ON public.tiers FOR SELECT
        USING (true);
  END IF;
END $$;


-- 3. NEWS PROMOTIONS TABLE POLICIES
-- ========================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'news_promotions') THEN
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
  END IF;
END $$;


-- 4. CUSTOMER SEGMENTS TABLE POLICIES
-- ========================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'customer_segments') THEN
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
  END IF;
END $$;
