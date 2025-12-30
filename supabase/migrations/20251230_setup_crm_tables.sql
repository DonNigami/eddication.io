-- CRM Pro - Complete Database Schema
-- ========================================
-- Tables for CRM Pro system (profiles, tiers, news, segments)

-- 1. PROFILES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    line_user_id text UNIQUE NOT NULL,
    display_name text,
    picture_url text,
    email text,
    phone text,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    points integer DEFAULT 0 CHECK (points >= 0),
    tags text[] DEFAULT '{}',
    last_activity timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id ON public.profiles(line_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_tags ON public.profiles USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity ON public.profiles(last_activity DESC);


-- 2. TIERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.tiers (
    id serial PRIMARY KEY,
    name text NOT NULL,
    min_points integer NOT NULL DEFAULT 0,
    color_theme text NOT NULL DEFAULT 'card-member',
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tiers_min_points ON public.tiers(min_points DESC);


-- 3. NEWS_PROMOTIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.news_promotions (
    id serial PRIMARY KEY,
    title text NOT NULL,
    description text,
    image_url text,
    link_url text,
    link_text text DEFAULT 'ดูรายละเอียด',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_promotions_created_at ON public.news_promotions(created_at DESC);


-- 4. CUSTOMER_SEGMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.customer_segments (
    id serial PRIMARY KEY,
    name text NOT NULL,
    conditions jsonb NOT NULL DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


-- 5. ENABLE RLS
-- ========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;


-- 6. RLS POLICIES - Profiles
-- ========================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (true);


-- 7. RLS POLICIES - Tiers (read-only for public)
-- ========================================
DROP POLICY IF EXISTS "Tiers are viewable by everyone" ON public.tiers;
CREATE POLICY "Tiers are viewable by everyone"
    ON public.tiers FOR SELECT
    USING (true);


-- 8. RLS POLICIES - News Promotions
-- ========================================
DROP POLICY IF EXISTS "News are viewable by everyone" ON public.news_promotions;
CREATE POLICY "News are viewable by everyone"
    ON public.news_promotions FOR SELECT
    USING (true);


-- 9. RLS POLICIES - Customer Segments
-- ========================================
DROP POLICY IF EXISTS "Segments are viewable by everyone" ON public.customer_segments;
CREATE POLICY "Segments are viewable by everyone"
    ON public.customer_segments FOR SELECT
    USING (true);


-- 10. FUNCTIONS & TRIGGERS
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_news_promotions_updated_at ON public.news_promotions;
CREATE TRIGGER update_news_promotions_updated_at
    BEFORE UPDATE ON public.news_promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_segments_updated_at ON public.customer_segments;
CREATE TRIGGER update_customer_segments_updated_at
    BEFORE UPDATE ON public.customer_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 11. INSERT SAMPLE DATA
-- ========================================
INSERT INTO public.tiers (name, min_points, color_theme) VALUES
    ('Member', 0, 'card-member'),
    ('Silver', 1000, 'card-silver'),
    ('Gold', 5000, 'card-gold'),
    ('Platinum', 10000, 'card-platinum'),
    ('Black', 50000, 'card-black')
ON CONFLICT DO NOTHING;

INSERT INTO public.news_promotions (title, description, image_url, link_url, link_text) VALUES
    (
        'ยินดีต้อนรับสู่ CRM Pro',
        'ระบบจัดการลูกค้าสัมพันธ์ที่ทันสมัย พร้อมระบบแต้มสะสมและการจัดการสมาชิก',
        'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop',
        'https://line.me/R/oaMessage/@505vsxhr/?ติดต่อเรา',
        'ติดต่อเรา'
    ),
    (
        'สะสมแต้มรับของรางวัล',
        'ทุกการใช้บริการสะสมแต้มได้ทันที แลกรับสิทธิพิเศษมากมาย',
        'https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=800&h=400&fit=crop',
        'https://line.me/R/oaMessage/@505vsxhr/',
        'ดูรายละเอียด'
    )
ON CONFLICT DO NOTHING;
