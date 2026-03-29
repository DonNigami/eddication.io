-- JETSETGO - All Migrations Combined
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/icgtllieipahixesllux/sql
-- FREE/OPEN SOURCE Edition

-- =====================================================
-- MIGRATION 001: Enable pgvector extension
-- =====================================================
\echo 'Applying Migration 001: pgvector extension...'

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Grant usage on vector type to authenticated and anon users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- MIGRATION 002: Core Catalog Tables
-- =====================================================
\echo 'Applying Migration 002: Catalog tables...'

-- CATALOG SOURCES TABLE
CREATE TABLE IF NOT EXISTS catalog_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'excel', 'csv', 'api')),
  file_path TEXT,
  file_size BIGINT,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PARTS CATALOG TABLE
CREATE TABLE IF NOT EXISTS parts_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT NOT NULL,
  oem_number TEXT,
  part_name_th TEXT,
  part_name_en TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  vehicle_make TEXT[],
  vehicle_model TEXT[],
  year_range TEXT,
  specifications JSONB DEFAULT '{}',
  price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  warehouse_location TEXT,
  image_url TEXT,
  source_id UUID REFERENCES catalog_sources(id) ON DELETE SET NULL,
  confidence_score DECIMAL(3,2),
  embedding vector(768),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Full-text search vector
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(part_number, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(oem_number, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(part_name_th, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(part_name_en, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(brand, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(category, '')), 'C')
  ) STORED
);

-- Unique constraint on part_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_part_number
  ON parts_catalog (LOWER(part_number))
  WHERE is_active = TRUE;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_parts_search_vector
  ON parts_catalog USING GIN (search_vector);

-- TIRES CATALOG TABLE
CREATE TABLE IF NOT EXISTS tires_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT NOT NULL,
  width INTEGER,
  aspect_ratio INTEGER,
  rim_diameter INTEGER,
  load_index TEXT,
  speed_rating TEXT,
  tire_type TEXT CHECK (tire_type IN ('summer', 'winter', 'all-season', 'performance', 'off-road')),
  vehicle_type TEXT CHECK (vehicle_type IN ('sedan', 'suv', 'truck', 'van', 'sports', 'motorcycle')),
  vehicle_make TEXT[],
  vehicle_model TEXT[],
  price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  warehouse_location TEXT,
  image_url TEXT,
  source_id UUID REFERENCES catalog_sources(id) ON DELETE SET NULL,
  embedding vector(768),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Full-text search vector
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(part_number, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(brand, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(model, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(size, '')), 'A')
  ) STORED
);

-- VEHICLE COMPATIBILITY TABLE
CREATE TABLE IF NOT EXISTS vehicle_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID NOT NULL REFERENCES parts_catalog(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_start INTEGER,
  year_end INTEGER,
  engine TEXT,
  trim TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vehicle compatibility
CREATE INDEX IF NOT EXISTS idx_vehicle_compat_part
  ON vehicle_compatibility(part_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_compat_vehicle
  ON vehicle_compatibility(make, model, year_start);

-- UPDATED AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION jetsetgo_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER update_catalog_sources_updated_at
  BEFORE UPDATE ON catalog_sources
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

CREATE TRIGGER update_parts_catalog_updated_at
  BEFORE UPDATE ON parts_catalog
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

-- =====================================================
-- MIGRATION 003: Document Ingestion Tracking Tables
-- =====================================================
\echo 'Applying Migration 003: Ingestion tables...'

-- INGESTION JOBS TABLE
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES catalog_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  stage TEXT CHECK (stage IN (
    'uploaded', 'ocr_processing', 'ocr_completed', 'extracting',
    'validating', 'embedding', 'indexing', 'completed'
  )),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_message TEXT,
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_successful INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source ON ingestion_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created ON ingestion_jobs(created_at DESC);

-- INGESTION LOGS TABLE
CREATE TABLE IF NOT EXISTS ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  details JSONB,
  stage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_job ON ingestion_logs(job_id, created_at DESC);

-- OCR RESULTS TABLE
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  source_id UUID REFERENCES catalog_sources(id) ON DELETE CASCADE,
  page_number INTEGER,
  file_path TEXT,
  raw_text TEXT,
  confidence DECIMAL(5,2),
  language TEXT,
  ocr_engine TEXT DEFAULT 'tesseract',
  processing_time_ms INTEGER,
  image_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_results_job ON ocr_results(job_id, page_number);

-- EXTRACTION RESULTS TABLE
CREATE TABLE IF NOT EXISTS extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  ocr_result_id UUID REFERENCES ocr_results(id) ON DELETE SET NULL,
  extraction_type TEXT CHECK (extraction_type IN ('table', 'form', 'line_item', 'header')),
  raw_data JSONB NOT NULL,
  mapped_to_table TEXT CHECK (mapped_to_table IN ('parts_catalog', 'tires_catalog', NULL)),
  catalog_record_id UUID,
  validation_status TEXT CHECK (validation_status IN ('pending', 'valid', 'invalid', 'needs_review')),
  validation_errors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extraction_results_job ON extraction_results(job_id);

-- VALIDATION QUEUE TABLE
CREATE TABLE IF NOT EXISTS validation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  extraction_result_id UUID REFERENCES extraction_results(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  proposed_data JSONB NOT NULL,
  issues JSONB,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  final_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_queue_status ON validation_queue(status, severity);

CREATE TRIGGER update_ingestion_jobs_updated_at
  BEFORE UPDATE ON ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

-- =====================================================
-- MIGRATION 004: LINE Bot Tables
-- =====================================================
\echo 'Applying Migration 004: LINE Bot tables...'

-- LINE BOT SESSIONS TABLE
CREATE TABLE IF NOT EXISTS linebot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  language TEXT NOT NULL DEFAULT 'th' CHECK (language IN ('th', 'en')),
  preferred_currency TEXT DEFAULT 'THB',
  conversation_context JSONB DEFAULT '{}',
  current_intent TEXT,
  conversation_state TEXT DEFAULT 'idle',
  user_vehicle JSONB,
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linebot_sessions_user_id ON linebot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_linebot_sessions_last_interaction ON linebot_sessions(last_interaction_at DESC);

-- SEARCH LOGS TABLE
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES linebot_sessions(id) ON DELETE SET NULL,
  user_id TEXT,
  query TEXT NOT NULL,
  query_type TEXT CHECK (query_type IN ('part_number', 'keyword', 'semantic', 'vehicle_compatibility', 'tire_size')),
  filters JSONB DEFAULT '{}',
  search_mode TEXT DEFAULT 'semantic',
  results_count INTEGER DEFAULT 0,
  top_result_id UUID,
  top_result_score DECIMAL(5,4),
  response_time_ms INTEGER,
  search_method TEXT,
  user_feedback TEXT CHECK (user_feedback IN ('positive', 'negative', 'neutral')),
  feedback_received_at TIMESTAMPTZ,
  clicked_result BOOLEAN DEFAULT FALSE,
  added_to_cart BOOLEAN DEFAULT FALSE,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_session ON search_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at DESC);

-- CONVERSATION MESSAGES TABLE
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES linebot_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'flex', 'location', 'postback')),
  intent_detected TEXT,
  entities_extracted JSONB,
  rag_context_used JSONB,
  model_used TEXT,
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session ON conversation_messages(session_id, created_at DESC);

-- PRODUCT INQUIRIES TABLE
CREATE TABLE IF NOT EXISTS product_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES linebot_sessions(id) ON DELETE SET NULL,
  user_id TEXT,
  catalog_type TEXT NOT NULL CHECK (catalog_type IN ('parts', 'tires')),
  catalog_record_id UUID NOT NULL,
  part_number TEXT NOT NULL,
  inquiry_type TEXT CHECK (inquiry_type IN ('availability', 'price', 'compatibility', 'general')),
  resolved BOOLEAN DEFAULT FALSE,
  follow_up_created BOOLEAN DEFAULT FALSE,
  follow_up_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FOLLOW-UP SUGGESTIONS TABLE
CREATE TABLE IF NOT EXISTS follow_up_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES linebot_sessions(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('related_products', 'compatibility_check', 'price_drop', 'restock', 'reminder')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_link TEXT,
  action_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'acted', 'cancelled')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_suggestions_session ON follow_up_suggestions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_up_suggestions_scheduled ON follow_up_suggestions(scheduled_for) WHERE status = 'pending';

CREATE TRIGGER update_linebot_sessions_updated_at
  BEFORE UPDATE ON linebot_sessions
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

-- =====================================================
-- MIGRATION 005: Vector Indexes
-- =====================================================
\echo 'Applying Migration 005: Vector indexes...'

-- HNSW indexes for vector search
CREATE INDEX IF NOT EXISTS idx_parts_embedding_hnsw
  ON parts_catalog
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_tires_embedding_hnsw
  ON tires_catalog
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_parts_brand_category_stock
  ON parts_catalog(brand, category, stock_quantity)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_parts_vehicle
  ON parts_catalog USING GIN (vehicle_make, vehicle_model)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_parts_price
  ON parts_catalog(price NULLS LAST)
  WHERE is_active = TRUE AND price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tires_size_type
  ON tires_catalog(size, tire_type, vehicle_type)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_tires_brand_model
  ON tires_catalog(brand, model)
  WHERE is_active = TRUE;

-- Partial indexes
CREATE INDEX IF NOT EXISTS idx_parts_in_stock
  ON parts_catalog(part_number, brand, category)
  WHERE is_active = TRUE AND stock_quantity > 0;

CREATE INDEX IF NOT EXISTS idx_parts_low_stock
  ON parts_catalog(category, brand, stock_quantity)
  WHERE is_active = TRUE AND stock_quantity >= 0 AND stock_quantity <= 10;

-- GIN indexes for JSONB
CREATE INDEX IF NOT EXISTS idx_parts_specs
  ON parts_catalog USING GIN (specifications)
  WHERE is_active = TRUE;

-- =====================================================
-- MIGRATION 006: Search Functions
-- =====================================================
\echo 'Applying Migration 006: Search functions...'

-- Semantic search function for parts
CREATE OR REPLACE FUNCTION jetsetgo_search_parts_semantic(
  query_embedding vector(768),
  max_results INTEGER DEFAULT 10,
  similarity_threshold DECIMAL DEFAULT 0.7,
  filter_brand TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  in_stock_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  part_number TEXT,
  oem_number TEXT,
  part_name_th TEXT,
  part_name_en TEXT,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  price DECIMAL,
  stock_quantity INTEGER,
  similarity DECIMAL,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.part_number, p.oem_number, p.part_name_th, p.part_name_en,
    p.description, p.category, p.subcategory, p.brand, p.price, p.stock_quantity,
    1 - (p.embedding <=> query_embedding) AS similarity,
    ROW_NUMBER() OVER (ORDER BY p.embedding <=> query_embedding) AS rank
  FROM parts_catalog p
  WHERE
    p.is_active = TRUE
    AND p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) >= similarity_threshold
    AND (filter_brand IS NULL OR p.brand = filter_brand)
    AND (filter_category IS NULL OR p.category = filter_category)
    AND (NOT in_stock_only OR p.stock_quantity > 0)
  ORDER BY p.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Semantic search function for tires
CREATE OR REPLACE FUNCTION jetsetgo_search_tires_semantic(
  query_embedding vector(768),
  max_results INTEGER DEFAULT 10,
  similarity_threshold DECIMAL DEFAULT 0.7,
  filter_brand TEXT DEFAULT NULL,
  filter_tire_type TEXT DEFAULT NULL,
  filter_size TEXT DEFAULT NULL,
  in_stock_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  part_number TEXT,
  brand TEXT,
  model TEXT,
  size TEXT,
  width INTEGER,
  aspect_ratio INTEGER,
  rim_diameter INTEGER,
  load_index TEXT,
  speed_rating TEXT,
  tire_type TEXT,
  vehicle_type TEXT,
  price DECIMAL,
  stock_quantity INTEGER,
  similarity DECIMAL,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.part_number, t.brand, t.model, t.size, t.width, t.aspect_ratio,
    t.rim_diameter, t.load_index, t.speed_rating, t.tire_type, t.vehicle_type,
    t.price, t.stock_quantity,
    1 - (t.embedding <=> query_embedding) AS similarity,
    ROW_NUMBER() OVER (ORDER BY t.embedding <=> query_embedding) AS rank
  FROM tires_catalog t
  WHERE
    t.is_active = TRUE
    AND t.embedding IS NOT NULL
    AND (1 - (t.embedding <=> query_embedding)) >= similarity_threshold
    AND (filter_brand IS NULL OR t.brand = filter_brand)
    AND (filter_tire_type IS NULL OR t.tire_type = filter_tire_type)
    AND (filter_size IS NULL OR t.size = filter_size)
    AND (NOT in_stock_only OR t.stock_quantity > 0)
  ORDER BY t.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Vehicle compatibility search
CREATE OR REPLACE FUNCTION jetsetgo_search_by_vehicle(
  make TEXT,
  model TEXT,
  year INTEGER DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  part_number TEXT,
  part_name_th TEXT,
  part_name_en TEXT,
  category TEXT,
  brand TEXT,
  price DECIMAL,
  stock_quantity INTEGER,
  compatibility_notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.id, p.part_number, p.part_name_th, p.part_name_en, p.category,
    p.brand, p.price, p.stock_quantity, vc.notes
  FROM parts_catalog p
  INNER JOIN vehicle_compatibility vc ON vc.part_id = p.id
  WHERE
    p.is_active = TRUE
    AND LOWER(vc.make) = LOWER(make)
    AND LOWER(vc.model) = LOWER(model)
    AND (year IS NULL OR (vc.year_start IS NULL AND vc.year_end IS NULL)
      OR (year >= vc.year_start AND year <= vc.year_end))
  ORDER BY p.category, p.brand
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get or create user session
CREATE OR REPLACE FUNCTION jetsetgo_get_or_create_session(
  p_user_id TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'th'
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  SELECT id INTO v_session_id
  FROM linebot_sessions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO linebot_sessions (user_id, display_name, language)
    VALUES (p_user_id, p_display_name, p_language)
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE linebot_sessions
    SET display_name = COALESCE(p_display_name, display_name),
        last_interaction_at = NOW(),
        message_count = message_count + 1
    WHERE id = v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MIGRATION 007: Row-Level Security
-- =====================================================
\echo 'Applying Migration 007: RLS policies...'

-- Enable RLS
ALTER TABLE catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE tires_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE linebot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_suggestions ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION jetsetgo_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- For now, return true for authenticated users
  -- In production, implement proper role checking
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Catalog policies - public read
CREATE POLICY "Allow public read access to catalog_sources"
  ON catalog_sources FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read access to active parts"
  ON parts_catalog FOR SELECT TO anon, authenticated USING (is_active = TRUE);

CREATE POLICY "Allow public read access to active tires"
  ON tires_catalog FOR SELECT TO anon, authenticated USING (is_active = TRUE);

CREATE POLICY "Allow public read access to vehicle_compatibility"
  ON vehicle_compatibility FOR SELECT TO anon, authenticated USING (true);

-- Authenticated users can manage data
CREATE POLICY "Allow authenticated to manage catalog_sources"
  ON catalog_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to manage parts"
  ON parts_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated to manage tires"
  ON tires_catalog FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ingestion policies
CREATE POLICY "Allow public read access to completed jobs"
  ON ingestion_jobs FOR SELECT TO anon, authenticated USING (status = 'completed');

CREATE POLICY "Allow authenticated to manage ingestion_jobs"
  ON ingestion_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LINE Bot policies
CREATE POLICY "Allow users to insert own sessions"
  ON linebot_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow users to update own sessions"
  ON linebot_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon to insert search logs"
  ON search_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated to insert search logs"
  ON search_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION jetsetgo_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_parts_semantic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_tires_semantic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_by_vehicle TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_get_or_create_session TO anon, authenticated;

-- =====================================================
-- STORAGE BUCKET SETUP
-- =====================================================
\echo 'Creating storage bucket...'

-- Create storage bucket for catalogs
INSERT INTO storage.buckets (id, name, public)
VALUES ('jetsetgo-catalogs', 'jetsetgo-catalogs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Allow public uploads to catalogs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'jetsetgo-catalogs');

CREATE POLICY "Allow public reads from catalogs"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'jetsetgo-catalogs');

-- =====================================================
-- DONE!
-- =====================================================
\echo '✅ All migrations applied successfully!'
\echo 'Project: JETSETGO - FREE/OPEN SOURCE Edition'

SELECT 'JETSETGO setup complete!' AS status;
