-- JETSETGO - Combined Database Migrations
-- Generated: 2026-02-11T04:05:54.536Z
-- Project: https://icgtllieipahixesllux.supabase.co

-- ========================================
-- IMPORTANT: Run each migration separately!
-- ========================================

-- jetsetgo_001_pgvector.sql (16 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 001: Enable pgvector extension
-- This enables vector similarity search capabilities

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Grant usage on vector type to authenticated and anon users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Comment
COMMENT ON EXTENSION vector IS 'Vector similarity search for RAG system';


-- ========================================
-- END OF jetsetgo_001_pgvector.sql
-- ========================================


-- jetsetgo_002_catalog_tables.sql (167 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 002: Core Catalog Tables
-- Parts and Tires catalog with vector support

-- Enable pgvector first (dependency)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- CATALOG SOURCES TABLE
-- Tracks uploaded PDF/Excel files
-- =====================================================
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

-- =====================================================
-- PARTS CATALOG TABLE
-- Main automotive parts catalog with vector search
-- =====================================================
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
  vehicle_make TEXT[], -- Array of compatible makes
  vehicle_model TEXT[], -- Array of compatible models
  year_range TEXT, -- e.g., "2015-2020" or "2015+"
  specifications JSONB DEFAULT '{}', -- Flexible spec storage
  price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  warehouse_location TEXT, -- e.g., "A-12-03"
  image_url TEXT,
  source_id UUID REFERENCES catalog_sources(id) ON DELETE SET NULL,
  confidence_score DECIMAL(3,2), -- OCR/extraction confidence 0-1
  embedding vector(768), -- 768 dimensions for nina-thai-v3
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

-- Unique constraint on part_number (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_parts_part_number
  ON parts_catalog (LOWER(part_number))
  WHERE is_active = TRUE;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_parts_search_vector
  ON parts_catalog USING GIN (search_vector);

-- =====================================================
-- TIRES CATALOG TABLE
-- Tire-specific catalog with vector search
-- =====================================================
CREATE TABLE IF NOT EXISTS tires_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  size TEXT NOT NULL, -- e.g., "205/55R16"
  width INTEGER, -- e.g., 205
  aspect_ratio INTEGER, -- e.g., 55
  rim_diameter INTEGER, -- e.g., 16
  load_index TEXT, -- e.g., "91"
  speed_rating TEXT, -- e.g., "H"
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

-- =====================================================
-- VEHICLE COMPATIBILITY MATRIX
-- Links parts to specific vehicles
-- =====================================================
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

-- Index for vehicle compatibility lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_compat_part
  ON vehicle_compatibility(part_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_compat_vehicle
  ON vehicle_compatibility(make, model, year_start);

-- =====================================================
-- UPDATED AT TRIGGER FUNCTION
-- Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_catalog_sources_updated_at
  BEFORE UPDATE ON catalog_sources
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

CREATE TRIGGER update_parts_catalog_updated_at
  BEFORE UPDATE ON parts_catalog
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE catalog_sources IS 'Source files for catalog data (PDF, Excel, etc.)';
COMMENT ON TABLE parts_catalog IS 'Automotive parts catalog with semantic search';
COMMENT ON TABLE tires_catalog IS 'Tire catalog with semantic search';
COMMENT ON TABLE vehicle_compatibility IS 'Part-to-vehicle compatibility matrix';
COMMENT ON COLUMN parts_catalog.embedding IS '768-dimensional vector for Thai semantic search';
COMMENT ON COLUMN tires_catalog.embedding IS '768-dimensional vector for Thai semantic search';


-- ========================================
-- END OF jetsetgo_002_catalog_tables.sql
-- ========================================


-- jetsetgo_003_ingestion_tables.sql (232 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 003: Document Ingestion Tracking Tables
-- Tracks OCR, extraction, and processing jobs

-- =====================================================
-- INGESTION JOBS TABLE
-- Tracks document processing pipeline
-- =====================================================
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES catalog_sources(id) ON DELETE CASCADE,

  -- Job status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Processing stage
  stage TEXT CHECK (stage IN (
    'uploaded',       -- File uploaded to storage
    'ocr_processing', -- Tesseract OCR running
    'ocr_completed',  -- OCR done
    'extracting',     -- Structured data extraction
    'validating',     -- Data validation
    'embedding',      -- Generating embeddings
    'indexing',       -- Creating vector indexes
    'completed'       -- All done
  )),

  -- Progress tracking
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_message TEXT,

  -- Error handling
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion TIMESTAMPTZ,

  -- Results
  records_processed INTEGER DEFAULT 0,
  records_successful INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job queries
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source
  ON ingestion_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status
  ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created
  ON ingestion_jobs(created_at DESC);

-- =====================================================
-- INGESTION LOGS TABLE
-- Detailed log entries for each job
-- =====================================================
CREATE TABLE IF NOT EXISTS ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,

  -- Log entry
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  details JSONB,

  -- Stage context
  stage TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_job
  ON ingestion_logs(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_level
  ON ingestion_logs(level);

-- =====================================================
-- OCR RESULTS TABLE
-- Stores raw OCR output for reference
-- =====================================================
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  source_id UUID REFERENCES catalog_sources(id) ON DELETE CASCADE,

  -- Page/document info
  page_number INTEGER,
  file_path TEXT,

  -- OCR results
  raw_text TEXT,
  confidence DECIMAL(5,2), -- 0-100
  language TEXT, -- 'tha', 'eng', 'tha+eng'

  -- Processing info
  ocr_engine TEXT DEFAULT 'tesseract',
  processing_time_ms INTEGER,

  -- Image reference (if scanned PDF)
  image_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for OCR result lookups
CREATE INDEX IF NOT EXISTS idx_ocr_results_job
  ON ocr_results(job_id, page_number);

-- =====================================================
-- EXTRACTION RESULTS TABLE
-- Stores structured extraction results
-- =====================================================
CREATE TABLE IF NOT EXISTS extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  ocr_result_id UUID REFERENCES ocr_results(id) ON DELETE SET NULL,

  -- Extraction type
  extraction_type TEXT CHECK (extraction_type IN ('table', 'form', 'line_item', 'header')),

  -- Extracted data (JSON for flexibility)
  raw_data JSONB NOT NULL,

  -- Mapped to catalog (if successful)
  mapped_to_table TEXT CHECK (mapped_to_table IN ('parts_catalog', 'tires_catalog', NULL)),
  catalog_record_id UUID,

  -- Validation
  validation_status TEXT CHECK (validation_status IN ('pending', 'valid', 'invalid', 'needs_review')),
  validation_errors JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for extraction lookups
CREATE INDEX IF NOT EXISTS idx_extraction_results_job
  ON extraction_results(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_results_status
  ON extraction_results(validation_status);

-- =====================================================
-- DATA VALIDATION QUEUE
-- Items needing manual review
-- =====================================================
CREATE TABLE IF NOT EXISTS validation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  extraction_result_id UUID REFERENCES extraction_results(id) ON DELETE SET NULL,

  -- Data to validate
  table_name TEXT NOT NULL, -- 'parts_catalog' or 'tires_catalog'
  proposed_data JSONB NOT NULL,

  -- Validation issues
  issues JSONB, -- Array of validation error objects
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),

  -- Review
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Final data (after modification if any)
  final_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for validation queue queries
CREATE INDEX IF NOT EXISTS idx_validation_queue_status
  ON validation_queue(status, severity);
CREATE INDEX IF NOT EXISTS idx_validation_queue_created
  ON validation_queue(created_at DESC);

-- =====================================================
-- UPDATED AT TRIGGER
-- =====================================================
CREATE TRIGGER update_ingestion_jobs_updated_at
  BEFORE UPDATE ON ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get job statistics
CREATE OR REPLACE FUNCTION jetsetgo_get_job_stats(job_id UUID)
RETURNS TABLE (
  total_pages INTEGER,
  o_completed INTEGER,
  total_extracted INTEGER,
  extraction_success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM ocr_results WHERE job_id = ingestion_jobs.job_id) AS total_pages,
    (SELECT COUNT(*) FROM ocr_results WHERE job_id = ingestion_jobs.job_id AND confidence > 70) AS o_completed,
    (SELECT COUNT(*) FROM extraction_results WHERE job_id = ingestion_jobs.job_id) AS total_extracted,
    (SELECT CASE
        WHEN COUNT(*) > 0 THEN
          ROUND(100.0 * (SELECT COUNT(*) FROM extraction_results WHERE job_id = ingestion_jobs.job_id AND validation_status = 'valid')::NUMERIC / COUNT(*), 2)
        ELSE 0
      END
      FROM extraction_results
      WHERE job_id = ingestion_jobs.job_id
    ) AS extraction_success_rate;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE ingestion_jobs IS 'Document processing pipeline jobs';
COMMENT ON TABLE ingestion_logs IS 'Detailed logs for ingestion jobs';
COMMENT ON TABLE ocr_results IS 'Raw OCR output from Tesseract';
COMMENT ON TABLE extraction_results IS 'Structured data extracted from OCR';
COMMENT ON TABLE validation_queue IS 'Items requiring manual data validation';


-- ========================================
-- END OF jetsetgo_003_ingestion_tables.sql
-- ========================================


-- jetsetgo_004_linebot_tables.sql (303 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 004: LINE Bot Tables
-- User sessions, conversations, and search analytics

-- =====================================================
-- LINE BOT SESSIONS TABLE
-- Stores user conversation context
-- =====================================================
CREATE TABLE IF NOT EXISTS linebot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LINE user identifiers
  user_id TEXT NOT NULL UNIQUE, -- LINE User ID
  display_name TEXT,

  -- User preferences
  language TEXT NOT NULL DEFAULT 'th' CHECK (language IN ('th', 'en')),
  preferred_currency TEXT DEFAULT 'THB',

  -- Conversation context for agentic AI
  conversation_context JSONB DEFAULT '{}',
  current_intent TEXT, -- Current detected intent
  conversation_state TEXT DEFAULT 'idle', -- idle, browsing, comparing, checkout

  -- Vehicle info (for compatibility checking)
  user_vehicle JSONB, -- {make, model, year, engine}

  -- Session tracking
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_blocked BOOLEAN DEFAULT FALSE,

  -- Metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick user lookups
CREATE INDEX IF NOT EXISTS idx_linebot_sessions_user_id
  ON linebot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_linebot_sessions_last_interaction
  ON linebot_sessions(last_interaction_at DESC);

-- =====================================================
-- SEARCH LOGS TABLE
-- All search queries with results and feedback
-- =====================================================
CREATE TABLE IF NOT EXISTS search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session
  session_id UUID REFERENCES linebot_sessions(id) ON DELETE SET NULL,
  user_id TEXT, -- Denormalized for analytics

  -- Query info
  query TEXT NOT NULL,
  query_type TEXT CHECK (query_type IN ('part_number', 'keyword', 'semantic', 'vehicle_compatibility', 'tire_size')),

  -- Search parameters
  filters JSONB DEFAULT '{}', -- {brand, category, price_range, etc.}
  search_mode TEXT DEFAULT 'semantic', -- 'keyword', 'semantic', 'hybrid'

  -- Results
  results_count INTEGER DEFAULT 0,
  top_result_id UUID, -- Reference to parts/tires catalog
  top_result_score DECIMAL(5,4), -- Similarity score

  -- Performance
  response_time_ms INTEGER,
  search_method TEXT, -- 'pgvector', 'fulltext', 'keyword'

  -- User feedback
  user_feedback TEXT CHECK (user_feedback IN ('positive', 'negative', 'neutral')),
  feedback_received_at TIMESTAMPTZ,

  -- Conversion tracking
  clicked_result BOOLEAN DEFAULT FALSE,
  added_to_cart BOOLEAN DEFAULT FALSE,
  converted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_search_logs_session
  ON search_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created
  ON search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_feedback
  ON search_logs(user_feedback) WHERE user_feedback IS NOT NULL;

-- =====================================================
-- CONVERSATION MESSAGES TABLE
-- Stores conversation history for context
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES linebot_sessions(id) ON DELETE CASCADE,

  -- Message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Message type
  message_type TEXT CHECK (message_type IN ('text', 'image', 'flex', 'location', 'postback')),

  -- AI context (for RAG)
  intent_detected TEXT,
  entities_extracted JSONB, -- {part_numbers, brands, vehicle_info}
  rag_context_used JSONB, -- The context used for generation

  -- Response metadata
  model_used TEXT, -- 'llama-3.1-8b-instant', etc.
  tokens_used INTEGER,
  generation_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for conversation history
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session
  ON conversation_messages(session_id, created_at DESC);

-- =====================================================
-- PRODUCT INQUIRIES TABLE
-- Track user interest in specific products
-- =====================================================
CREATE TABLE IF NOT EXISTS product_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES linebot_sessions(id) ON DELETE SET NULL,
  user_id TEXT,

  -- Product
  catalog_type TEXT NOT NULL CHECK (catalog_type IN ('parts', 'tires')),
  catalog_record_id UUID NOT NULL,
  part_number TEXT NOT NULL,

  -- Inquiry context
  inquiry_type TEXT CHECK (inquiry_type IN ('availability', 'price', 'compatibility', 'general')),
  resolved BOOLEAN DEFAULT FALSE,

  -- Follow-up
  follow_up_created BOOLEAN DEFAULT FALSE,
  follow_up_scheduled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for inquiry tracking
CREATE INDEX IF NOT EXISTS idx_product_inquiries_session
  ON product_inquiries(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_part
  ON product_inquiries(part_number);

-- =====================================================
-- FOLLOW-UP SUGGESTIONS TABLE
-- Agentic AI follow-up recommendations
-- =====================================================
CREATE TABLE IF NOT EXISTS follow_up_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES linebot_sessions(id) ON DELETE CASCADE,

  -- Suggestion
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('related_products', 'compatibility_check', 'price_drop', 'restock', 'reminder')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Action
  action_link TEXT,
  action_data JSONB,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'acted', 'cancelled')),

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,

  -- Results
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for follow-up management
CREATE INDEX IF NOT EXISTS idx_follow_up_suggestions_session
  ON follow_up_suggestions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_follow_up_suggestions_scheduled
  ON follow_up_suggestions(scheduled_for) WHERE status = 'pending';

-- =====================================================
-- UPDATED AT TRIGGERS
-- =====================================================
CREATE TRIGGER update_linebot_sessions_updated_at
  BEFORE UPDATE ON linebot_sessions
  FOR EACH ROW EXECUTE FUNCTION jetsetgo_update_updated_at();

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Daily search analytics
CREATE OR REPLACE VIEW jetsetgo_daily_search_analytics AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_searches,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT session_id) AS unique_sessions,
  AVG(results_count) AS avg_results,
  AVG(response_time_ms) AS avg_response_time_ms,
  SUM(CASE WHEN user_feedback = 'positive' THEN 1 ELSE 0 END) AS positive_feedback,
  SUM(CASE WHEN user_feedback = 'negative' THEN 1 ELSE 0 END) AS negative_feedback,
  SUM(CASE WHEN clicked_result THEN 1 ELSE 0 END) AS result_clicks,
  ROUND(100.0 * SUM(CASE WHEN clicked_result THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS click_rate
FROM search_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Popular searches
CREATE OR REPLACE VIEW jetsetgo_popular_searches AS
SELECT
  LOWER(query) AS query_normalized,
  COUNT(*) AS search_count,
  COUNT(DISTINCT user_id) AS unique_users,
  AVG(results_count) AS avg_results,
  ROUND(100.0 * SUM(CASE WHEN user_feedback = 'positive' THEN 1 ELSE 0 END) / NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0), 2) AS positive_rate
FROM search_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY LOWER(query)
ORDER BY search_count DESC
LIMIT 100;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get or create user session
CREATE OR REPLACE FUNCTION jetsetgo_get_or_create_session(
  p_user_id TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'th'
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Try to get existing session
  SELECT id INTO v_session_id
  FROM linebot_sessions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If not found, create new
  IF NOT FOUND THEN
    INSERT INTO linebot_sessions (user_id, display_name, language)
    VALUES (p_user_id, p_display_name, p_language)
    RETURNING id INTO v_session_id;
    v_is_new := TRUE;
  ELSE
    -- Update existing session
    UPDATE linebot_sessions
    SET
      display_name = COALESCE(p_display_name, display_name),
      last_interaction_at = NOW(),
      message_count = message_count + 1
    WHERE id = v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Update conversation context
CREATE OR REPLACE FUNCTION jetsetgo_update_conversation_context(
  p_session_id UUID,
  p_context JSONB,
  p_intent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE linebot_sessions
  SET
    conversation_context = p_context,
    current_intent = COALESCE(p_intent, current_intent),
    updated_at = NOW()
  WHERE id = p_session_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE linebot_sessions IS 'LINE Bot user sessions and context';
COMMENT ON TABLE search_logs IS 'All search queries with analytics';
COMMENT ON TABLE conversation_messages IS 'Conversation history for AI context';
COMMENT ON TABLE product_inquiries IS 'Product interest tracking';
COMMENT ON TABLE follow_up_suggestions IS 'Agentic AI follow-up recommendations';


-- ========================================
-- END OF jetsetgo_004_linebot_tables.sql
-- ========================================


-- jetsetgo_005_vector_indexes.sql (167 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 005: Vector Indexes for Semantic Search
-- HNSW indexes for fast vector similarity search

-- =====================================================
-- HNSW INDEXES FOR VECTOR SEARCH
-- Hierarchical Navigable Small World (HNSW) indexes
-- provide fast approximate nearest neighbor search
-- =====================================================

-- Parts catalog HNSW index (cosine similarity)
-- m = 16: number of bidirectional links per node
-- ef_construction = 64: size of dynamic candidate list for construction
CREATE INDEX IF NOT EXISTS idx_parts_embedding_hnsw
  ON parts_catalog
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Tires catalog HNSW index (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_tires_embedding_hnsw
  ON tires_catalog
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =====================================================

-- Parts catalog: Brand + Category + Stock
CREATE INDEX IF NOT EXISTS idx_parts_brand_category_stock
  ON parts_catalog(brand, category, stock_quantity)
  WHERE is_active = TRUE;

-- Parts catalog: Vehicle make/model lookup
CREATE INDEX IF NOT EXISTS idx_parts_vehicle
  ON parts_catalog USING GIN (vehicle_make, vehicle_model)
  WHERE is_active = TRUE;

-- Parts catalog: Price range queries
CREATE INDEX IF NOT EXISTS idx_parts_price
  ON parts_catalog(price NULLS LAST)
  WHERE is_active = TRUE AND price IS NOT NULL;

-- Tires catalog: Size + Type + Vehicle
CREATE INDEX IF NOT EXISTS idx_tires_size_type
  ON tires_catalog(size, tire_type, vehicle_type)
  WHERE is_active = TRUE;

-- Tires catalog: Brand + Model lookup
CREATE INDEX IF NOT EXISTS idx_tires_brand_model
  ON tires_catalog(brand, model)
  WHERE is_active = TRUE;

-- =====================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- =====================================================

-- In-stock parts only (for availability searches)
CREATE INDEX IF NOT EXISTS idx_parts_in_stock
  ON parts_catalog(part_number, brand, category)
  WHERE is_active = TRUE AND stock_quantity > 0;

-- Low stock alert (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_parts_low_stock
  ON parts_catalog(category, brand, stock_quantity)
  WHERE is_active = TRUE AND stock_quantity >= 0 AND stock_quantity <= 10;

-- Out of stock parts
CREATE INDEX IF NOT EXISTS idx_parts_out_of_stock
  ON parts_catalog(part_number, part_name_th, part_name_en)
  WHERE is_active = TRUE AND stock_quantity = 0;

-- High confidence OCR results (for trusted data)
CREATE INDEX IF NOT EXISTS idx_parts_high_confidence
  ON parts_catalog(part_number, category, brand)
  WHERE is_active = TRUE AND confidence_score >= 0.8;

-- =====================================================
-- GIN INDEXES FOR JSONB FIELDS
-- =====================================================

-- Parts specifications JSONB (for flexible queries)
CREATE INDEX IF NOT EXISTS idx_parts_specs
  ON parts_catalog USING GIN (specifications)
  WHERE is_active = TRUE;

-- Ingestion job metadata
CREATE INDEX IF NOT EXISTS idx_ingestion_metadata
  ON ingestion_jobs USING GIN (metadata);

-- OCR result details
CREATE INDEX IF NOT EXISTS idx_ocr_details
  ON ocr_results USING GIN (error_details);

-- =====================================================
-- TRIGGERS FOR MAINTAINING SEARCH QUALITY
-- =====================================================

-- Function to check if embedding is NULL and log it
CREATE OR REPLACE FUNCTION jetsetgo_check_embedding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.embedding IS NULL AND OLD.embedding IS NULL THEN
    RAISE WARNING 'Part % has no embedding vector', NEW.part_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply check on insert/update (optional, for monitoring)
-- Comment out to avoid overhead in production
-- CREATE TRIGGER check_parts_embedding
--   BEFORE INSERT OR UPDATE ON parts_catalog
--   FOR EACH ROW EXECUTE FUNCTION jetsetgo_check_embedding();

-- =====================================================
-- VECTOR STATISTICS VIEW
-- Shows vector search index health
-- =====================================================
CREATE OR REPLACE VIEW jetsetgo_vector_stats AS
WITH part_stats AS (
  SELECT
    'parts_catalog' AS table_name,
    COUNT(*) AS total_records,
    COUNT(embedding) AS records_with_embedding,
    ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) AS coverage_percent,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS active_records
  FROM parts_catalog
),
tire_stats AS (
  SELECT
    'tires_catalog' AS table_name,
    COUNT(*) AS total_records,
    COUNT(embedding) AS records_with_embedding,
    ROUND(100.0 * COUNT(embedding) / NULLIF(COUNT(*), 0), 2) AS coverage_percent,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS active_records
  FROM tires_catalog
)
SELECT * FROM part_stats
UNION ALL
SELECT * FROM tire_stats;

-- =====================================================
-- INDEX USAGE MONITORING VIEW
-- Track which indexes are being used
-- =====================================================
CREATE OR REPLACE VIEW jetsetgo_index_usage AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE '%catalog%'
ORDER BY idx_scan DESC;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON INDEX idx_parts_embedding_hnsw IS 'HNSW index for vector similarity search on parts (cosine)';
COMMENT ON INDEX idx_tires_embedding_hnsw IS 'HNSW index for vector similarity search on tires (cosine)';
COMMENT ON VIEW jetsetgo_vector_stats IS 'Statistics on vector coverage across catalog tables';
COMMENT ON VIEW jetsetgo_index_usage IS 'Monitor index usage patterns for optimization';


-- ========================================
-- END OF jetsetgo_005_vector_indexes.sql
-- ========================================


-- jetsetgo_006_search_functions.sql (489 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 006: Semantic Search Functions
-- Core search functions for RAG system

-- =====================================================
-- SEMANTIC SEARCH FUNCTION - PARTS
-- Search parts catalog using vector similarity
-- =====================================================
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
    p.id,
    p.part_number,
    p.oem_number,
    p.part_name_th,
    p.part_name_en,
    p.description,
    p.category,
    p.subcategory,
    p.brand,
    p.price,
    p.stock_quantity,
    1 - (p.embedding <=> query_embedding) AS similarity, -- Cosine similarity
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

-- =====================================================
-- SEMANTIC SEARCH FUNCTION - TIRES
-- Search tires catalog using vector similarity
-- =====================================================
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
    t.id,
    t.part_number,
    t.brand,
    t.model,
    t.size,
    t.width,
    t.aspect_ratio,
    t.rim_diameter,
    t.load_index,
    t.speed_rating,
    t.tire_type,
    t.vehicle_type,
    t.price,
    t.stock_quantity,
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

-- =====================================================
-- HYBRID SEARCH FUNCTION - PARTS
-- Combines semantic vector search with full-text search
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_search_parts_hybrid(
  query_text TEXT,
  query_embedding vector(768),
  max_results INTEGER DEFAULT 10,
  semantic_weight DECIMAL DEFAULT 0.7, -- Weight for vector search
  keyword_weight DECIMAL DEFAULT 0.3,   -- Weight for full-text
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
  brand TEXT,
  price DECIMAL,
  stock_quantity INTEGER,
  combined_score DECIMAL,
  semantic_score DECIMAL,
  keyword_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Semantic search results
  semantic AS (
    SELECT
      p.id,
      (1 - (p.embedding <=> query_embedding)) AS score
    FROM parts_catalog p
    WHERE
      p.is_active = TRUE
      AND p.embedding IS NOT NULL
      AND (NOT in_stock_only OR p.stock_quantity > 0)
    ORDER BY p.embedding <=> query_embedding
    LIMIT max_results * 2 -- Get more for ranking
  ),
  -- Keyword search results
  keyword AS (
    SELECT
      p.id,
      TS_RANK(p.search_vector, PLAINTO_TSQUERY('simple', query_text)) AS score
    FROM parts_catalog p
    WHERE
      p.is_active = TRUE
      AND p.search_vector @@ PLAINTO_TSQUERY('simple', query_text)
      AND (NOT in_stock_only OR p.stock_quantity > 0)
    ORDER BY score DESC
    LIMIT max_results * 2
  )
  SELECT
    p.id,
    p.part_number,
    p.oem_number,
    p.part_name_th,
    p.part_name_en,
    p.description,
    p.category,
    p.brand,
    p.price,
    p.stock_quantity,
    COALESCE(s.score * semantic_weight, 0) +
      COALESCE(k.score * keyword_weight, 0) AS combined_score,
    s.score AS semantic_score,
    k.score AS keyword_score
  FROM parts_catalog p
  LEFT JOIN semantic s ON s.id = p.id
  LEFT JOIN keyword k ON k.id = p.id
  WHERE
    s.id IS NOT NULL OR k.id IS NOT NULL
  ORDER BY combined_score DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- PART NUMBER SEARCH (Exact/Fuzzy)
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_search_part_number(
  search_term TEXT,
  max_results INTEGER DEFAULT 10,
  exact_match BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  part_number TEXT,
  oem_number TEXT,
  part_name_th TEXT,
  part_name_en TEXT,
  brand TEXT,
  category TEXT,
  price DECIMAL,
  stock_quantity INTEGER,
  match_type TEXT
) AS $$
BEGIN
  IF exact_match THEN
    RETURN QUERY
    SELECT
      p.id,
      p.part_number,
      p.oem_number,
      p.part_name_th,
      p.part_name_en,
      p.brand,
      p.category,
      p.price,
      p.stock_quantity,
      'exact'::TEXT AS match_type
    FROM parts_catalog p
    WHERE
      p.is_active = TRUE
      AND LOWER(p.part_number) = LOWER(search_term)
    LIMIT max_results;
  ELSE
    RETURN QUERY
    SELECT
      p.id,
      p.part_number,
      p.oem_number,
      p.part_name_th,
      p.part_name_en,
      p.brand,
      p.category,
      p.price,
      p.stock_quantity,
      CASE
        WHEN LOWER(p.part_number) = LOWER(search_term) THEN 'exact'
        WHEN p.part_number % search_term THEN 'fuzzy'
        ELSE 'contains'
      END::TEXT AS match_type
    FROM parts_catalog p
    WHERE
      p.is_active = TRUE
      AND (
        LOWER(p.part_number) = LOWER(search_term)
        OR p.part_number % search_term
        OR LOWER(p.part_number) LIKE '%' || LOWER(search_term) || '%'
      )
    ORDER BY
      CASE
        WHEN LOWER(p.part_number) = LOWER(search_term) THEN 1
        WHEN p.part_number % search_term THEN 2
        ELSE 3
      END
    LIMIT max_results;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- VEHICLE COMPATIBILITY SEARCH
-- Find parts compatible with a specific vehicle
-- =====================================================
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
    p.id,
    p.part_number,
    p.part_name_th,
    p.part_name_en,
    p.category,
    p.brand,
    p.price,
    p.stock_quantity,
    vc.notes
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

-- =====================================================
-- TIRE SIZE SEARCH
-- Exact match on tire dimensions
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_search_tire_size(
  width INTEGER DEFAULT NULL,
  aspect_ratio INTEGER DEFAULT NULL,
  rim_diameter INTEGER DEFAULT NULL,
  size_text TEXT DEFAULT NULL,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  part_number TEXT,
  brand TEXT,
  model TEXT,
  size TEXT,
  tire_type TEXT,
  vehicle_type TEXT,
  price DECIMAL,
  stock_quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.part_number,
    t.brand,
    t.model,
    t.size,
    t.tire_type,
    t.vehicle_type,
    t.price,
    t.stock_quantity
  FROM tires_catalog t
  WHERE
    t.is_active = TRUE
    AND (
      size_text IS NOT NULL AND t.size = size_text
      OR (
        (width IS NULL OR t.width = width)
        AND (aspect_ratio IS NULL OR t.aspect_ratio = aspect_ratio)
        AND (rim_diameter IS NULL OR t.rim_diameter = rim_diameter)
      )
    )
  ORDER BY t.brand, t.model
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- RAG CONTEXT BUILDER
-- Builds context string from search results for LLM
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_build_rag_context(
  part_ids UUID[],
  include_specs BOOLEAN DEFAULT TRUE,
  include_stock BOOLEAN DEFAULT TRUE
)
RETURNS TEXT AS $$
DECLARE
  context_text TEXT := '';
  part_record RECORD;
BEGIN
  FOR part_record IN
    SELECT
      p.part_number,
      p.oem_number,
      p.part_name_th,
      p.part_name_en,
      p.description,
      p.category,
      p.subcategory,
      p.brand,
      p.price,
      p.stock_quantity,
      p.specifications
    FROM parts_catalog p
    WHERE p.id = ANY(part_ids)
    ORDER BY p.part_number
  LOOP
    context_text := context_text ||
      E'Part Number: ' || COALESCE(part_record.part_number, '') ||
      E'\nOEM: ' || COALESCE(part_record.oem_number, 'N/A') ||
      E'\nName (TH): ' || COALESCE(part_record.part_name_th, '') ||
      E'\nName (EN): ' || COALESCE(part_record.part_name_en, '') ||
      E'\nBrand: ' || COALESCE(part_record.brand, '') ||
      E'\nCategory: ' || COALESCE(part_record.category, '') ||
      CASE
        WHEN part_record.price IS NOT NULL THEN E'\nPrice: ' || part_record.price::TEXT || ' THB'
        ELSE ''
      END ||
      CASE
        WHEN include_stock AND part_record.stock_quantity IS NOT NULL
          THEN E'\nStock: ' || part_record.stock_quantity::TEXT
        ELSE ''
      END ||
      CASE
        WHEN include_specs AND part_record.specifications IS NOT NULL
          THEN E'\nSpecs: ' || jsonb_pretty(part_record.specifications)::TEXT
        ELSE ''
      END ||
      E'\n---\n';
  END LOOP;

  RETURN context_text;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- LOG SEARCH FUNCTION
-- Logs search queries for analytics
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_log_search(
  p_session_id UUID DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_query TEXT,
  p_query_type TEXT DEFAULT 'semantic',
  p_results_count INTEGER DEFAULT 0,
  p_top_result_id UUID DEFAULT NULL,
  p_top_result_score DECIMAL DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO search_logs (
    session_id,
    user_id,
    query,
    query_type,
    results_count,
    top_result_id,
    top_result_score,
    response_time_ms
  ) VALUES (
    p_session_id,
    p_user_id,
    p_query,
    p_query_type,
    p_results_count,
    p_top_result_id,
    p_top_result_score,
    p_response_time_ms
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION jetsetgo_search_parts_semantic IS 'Semantic search for parts using vector similarity';
COMMENT ON FUNCTION jetsetgo_search_tires_semantic IS 'Semantic search for tires using vector similarity';
COMMENT ON FUNCTION jetsetgo_search_parts_hybrid IS 'Hybrid search combining semantic and keyword search';
COMMENT ON FUNCTION jetsetgo_search_part_number IS 'Exact/fuzzy part number search';
COMMENT ON FUNCTION jetsetgo_search_by_vehicle IS 'Find parts by vehicle compatibility';
COMMENT ON FUNCTION jetsetgo_search_tire_size IS 'Search tires by size dimensions';
COMMENT ON FUNCTION jetsetgo_build_rag_context IS 'Build RAG context string from part IDs';
COMMENT ON FUNCTION jetsetgo_log_search IS 'Log search queries for analytics';


-- ========================================
-- END OF jetsetgo_006_search_functions.sql
-- ========================================


-- jetsetgo_007_rls_policies.sql (436 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO Migration 007: Row-Level Security (RLS) Policies
-- Security policies for catalog, ingestion, and LINE bot tables

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

-- Catalog tables
ALTER TABLE catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE tires_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_compatibility ENABLE ROW LEVEL SECURITY;

-- Ingestion tables
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_queue ENABLE ROW LEVEL SECURITY;

-- LINE Bot tables
ALTER TABLE linebot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_suggestions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: CHECK IF USER IS ADMIN
-- =====================================================
CREATE OR REPLACE FUNCTION jetsetgo_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN := FALSE;
BEGIN
  -- Check if user has admin role
  -- This can be extended to check against a user_roles table
  -- For now, we use service role key check via context

  -- Service role always has admin access
  IF (
    SELECT true
    FROM pg_roles
    WHERE rolname = current_user
    AND rolname = 'service_role'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check auth.jwt() for custom claims (if using auth.users)
  -- This requires Supabase Auth integration

  RETURN is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINer;

-- =====================================================
-- CATALOG TABLES POLICIES
-- =====================================================

-- catalog_sources
CREATE POLICY "Allow public read access to catalog_sources"
  ON catalog_sources FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admins to insert catalog_sources"
  ON catalog_sources FOR INSERT
  TO authenticated
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to update catalog_sources"
  ON catalog_sources FOR UPDATE
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to delete catalog_sources"
  ON catalog_sources FOR DELETE
  TO authenticated
  USING (jetsetgo_is_admin());

-- parts_catalog
CREATE POLICY "Allow public read access to active parts"
  ON parts_catalog FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY "Allow admins to read all parts"
  ON parts_catalog FOR SELECT
  TO authenticated
  USING (jetsetgo_is_admin());

CREATE POLICY "Allow admins to insert parts"
  ON parts_catalog FOR INSERT
  TO authenticated
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to update parts"
  ON parts_catalog FOR UPDATE
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to delete parts"
  ON parts_catalog FOR DELETE
  TO authenticated
  USING (jetsetgo_is_admin());

-- tires_catalog
CREATE POLICY "Allow public read access to active tires"
  ON tires_catalog FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY "Allow admins to read all tires"
  ON tires_catalog FOR SELECT
  TO authenticated
  USING (jetsetgo_is_admin());

CREATE POLICY "Allow admins to insert tires"
  ON tires_catalog FOR INSERT
  TO authenticated
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to update tires"
  ON tires_catalog FOR UPDATE
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to delete tires"
  ON tires_catalog FOR DELETE
  TO authenticated
  USING (jetsetgo_is_admin());

-- vehicle_compatibility
CREATE POLICY "Allow public read access to vehicle_compatibility"
  ON vehicle_compatibility FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admins to manage vehicle_compatibility"
  ON vehicle_compatibility FOR ALL
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

-- =====================================================
-- INGESTION TABLES POLICIES
-- =====================================================

-- ingestion_jobs
CREATE POLICY "Allow public read access to completed jobs"
  ON ingestion_jobs FOR SELECT
  TO anon, authenticated
  USING (status = 'completed');

CREATE POLICY "Allow admins to manage all ingestion_jobs"
  ON ingestion_jobs FOR ALL
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

-- ingestion_logs
CREATE POLICY "Allow public read access to logs for completed jobs"
  ON ingestion_logs FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ingestion_jobs
      WHERE id = ingestion_logs.job_id
      AND status = 'completed'
    )
  );

CREATE POLICY "Allow admins to manage all ingestion_logs"
  ON ingestion_logs FOR ALL
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

-- ocr_results
CREATE POLICY "Allow public read access to OCR results for completed jobs"
  ON ocr_results FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ingestion_jobs
      WHERE id = ocr_results.job_id
      AND status = 'completed'
    )
  );

CREATE POLICY "Allow admins to manage all ocr_results"
  ON ocr_results FOR ALL
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

-- extraction_results
CREATE POLICY "Allow public read access to extraction results for completed jobs"
  ON extraction_results FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ingestion_jobs
      WHERE id = extraction_results.job_id
      AND status = 'completed'
    )
  );

CREATE POLICY "Allow admins to manage all extraction_results"
  ON extraction_results FOR ALL
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

-- validation_queue
CREATE POLICY "Allow authenticated users to read validation_queue"
  ON validation_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to insert validation_queue"
  ON validation_queue FOR INSERT
  TO authenticated
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to update validation_queue"
  ON validation_queue FOR UPDATE
  TO authenticated
  USING (jetsetgo_is_admin())
  WITH CHECK (jetsetgo_is_admin());

CREATE POLICY "Allow admins to delete validation_queue"
  ON validation_queue FOR DELETE
  TO authenticated
  USING (jetsetgo_is_admin());

-- =====================================================
-- LINE BOT TABLES POLICIES
-- =====================================================

-- linebot_sessions
CREATE POLICY "Allow users to read own sessions"
  ON linebot_sessions FOR SELECT
  TO authenticated
  USING (
    user_id = (
      SELECT raw_user_id_data()::json->>'user_id'
      LIMIT 1
    )
    OR jetsetgo_is_admin()
  );

CREATE POLICY "Allow anon users to insert own sessions"
  ON linebot_sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert own sessions"
  ON linebot_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow users to update own sessions"
  ON linebot_sessions FOR UPDATE
  TO authenticated
  USING (
    user_id = (
      SELECT raw_user_id_data()::json->>'user_id'
      LIMIT 1
    )
    OR jetsetgo_is_admin()
  )
  WITH CHECK (
    user_id = (
      SELECT raw_user_id_data()::json->>'user_id'
      LIMIT 1
    )
    OR jetsetgo_is_admin()
  );

CREATE POLICY "Allow admins to delete sessions"
  ON linebot_sessions FOR DELETE
  TO authenticated
  USING (jetsetgo_is_admin());

-- search_logs
CREATE POLICY "Allow public read access to aggregated search logs"
  ON search_logs FOR SELECT
  TO anon, authenticated
  USING (
    -- Only allow access to aggregated/anonymized data in production
    -- For now, allow admins full access
    jetsetgo_is_admin()
  );

CREATE POLICY "Allow anon users to insert search logs"
  ON search_logs FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert search logs"
  ON search_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow users to update own search logs"
  ON search_logs FOR UPDATE
  TO authenticated
  USING (
    user_id = (
      SELECT raw_user_id_data()::json->>'user_id'
      LIMIT 1
    )
  )
  WITH CHECK (
    user_id = (
      SELECT raw_user_id_data()::json->>'user_id'
      LIMIT 1
    )
  );

-- conversation_messages
CREATE POLICY "Allow users to read own messages"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM linebot_sessions
      WHERE id = conversation_messages.session_id
      AND user_id = (raw_user_id_data()::json->>'user_id')
    )
    OR jetsetgo_is_admin()
  );

CREATE POLICY "Allow anon users to insert messages"
  ON conversation_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert messages"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- product_inquiries
CREATE POLICY "Allow users to read own inquiries"
  ON product_inquiries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM linebot_sessions
      WHERE id = product_inquiries.session_id
      AND user_id = (raw_user_id_data()::json->>'user_id')
    )
    OR jetsetgo_is_admin()
  );

CREATE POLICY "Allow anon users to insert inquiries"
  ON product_inquiries FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert inquiries"
  ON product_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- follow_up_suggestions
CREATE POLICY "Allow users to read own follow-ups"
  ON follow_up_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM linebot_sessions
      WHERE id = follow_up_suggestions.session_id
      AND user_id = (raw_user_id_data()::json->>'user_id')
    )
    OR jetsetgo_is_admin()
  );

CREATE POLICY "Allow anon users to insert follow-ups"
  ON follow_up_suggestions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to insert follow-ups"
  ON follow_up_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow users to update own follow-ups"
  ON follow_up_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM linebot_sessions
      WHERE id = follow_up_suggestions.session_id
      AND user_id = (raw_user_id_data()::json->>'user_id')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM linebot_sessions
      WHERE id = follow_up_suggestions.session_id
      AND user_id = (raw_user_id_data()::json->>'user_id')
    )
  );

-- =====================================================
-- SECURITY DEFINER FUNCTIONS
-- Grant execute permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION jetsetgo_is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_parts_semantic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_tires_semantic TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_parts_hybrid TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_part_number TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_by_vehicle TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_search_tire_size TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_build_rag_context TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_log_search TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_get_job_stats TO authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_get_or_create_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION jetsetgo_update_conversation_context TO anon, authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION jetsetgo_is_admin IS 'Check if current user has admin privileges';
COMMENT ON POLICY "Allow public read access to active parts" ON parts_catalog IS 'Allows read access to active parts for all users';


-- ========================================
-- END OF jetsetgo_007_rls_policies.sql
-- ========================================


-- jetsetgo_008_agent_tables.sql (286 lines)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
-- JETSETGO - Agentic AI System Tables
-- Migration for Multi-Agent System Conversation Memory

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CONVERSATION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_conversation_session (session_id),
  INDEX idx_conversation_user (user_id),
  INDEX idx_conversation_created (created_at DESC)
);

-- ============================================
-- AGENT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT,
  query TEXT NOT NULL,
  intent TEXT NOT NULL,
  agent TEXT NOT NULL,
  language TEXT CHECK (language IN ('th', 'en')),
  confidence DECIMAL(3,2),
  execution_time INTEGER, -- milliseconds
  success BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_agent_logs_session (session_id),
  INDEX idx_agent_logs_user (user_id),
  INDEX idx_agent_logs_intent (intent),
  INDEX idx_agent_logs_created (created_at DESC)
);

-- ============================================
-- PROMOTIONS TABLE (for Price Advisor)
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_th TEXT,
  description TEXT,
  description_th TEXT,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'buy_x_get_y')),
  discount_percent DECIMAL(5,2),
  discount_amount DECIMAL(10,2),
  min_purchase DECIMAL(10,2),
  categories TEXT[], -- ['tires', 'oil', 'brakes']
  brands TEXT[], -- ['Michelin', 'Bridgestone']
  active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample promotions
INSERT INTO promotions (name, name_th, description, description_th, discount_percent, categories, active, start_date, end_date) VALUES
('Summer Tire Sale', 'โปรซื้อยางร้อน', 'Up to 15% off on selected summer tires', 'ลดราคายางรุ่นที่เลือกสูงสุด 15%', 15, ARRAY['tires'], true, NOW(), NOW() + INTERVAL '3 months'),
('Oil Change Special', 'โปรเปลี่ยนน้ำมัน', 'Free filter with engine oil purchase', 'แถมฟิลเตอร์ฟรีเมื่อซื้อน้ำมันเครื่อง', 0, ARRAY['oil', 'filters'], true, NOW(), NOW() + INTERVAL '1 month'),
('Brake Pad Bundle', 'โปรชุดเบรก', '10% off when buying front and rear brake pads together', 'ซื้อดิสก์เบร์หน้า-หลังคู่ลด 10%', 10, ARRAY['brakes'], true, NOW(), NOW() + INTERVAL '2 months')
ON CONFLICT DO NOTHING;

-- ============================================
-- VEHICLE COMPATIBILITY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vehicle_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id UUID REFERENCES parts_catalog(id) ON DELETE CASCADE,
  part_number TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_start INTEGER,
  year_end INTEGER,
  engine TEXT,
  trim TEXT,
  notes TEXT,
  compatible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(part_number, make, model, year_start)
);

-- ============================================
-- AGENT MEMORY TABLE (for persistent memory)
-- ============================================
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  memory_type TEXT CHECK (memory_type IN ('user_preference', 'search_result', 'conversation_turn', 'correction')),
  data JSONB NOT NULL,
  importance DECIMAL(3,2) DEFAULT 0.5, -- 0-1
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_memory_user (user_id),
  INDEX idx_memory_session (session_id),
  INDEX idx_memory_expires (expires_at)
);

-- Function to clean expired memory
CREATE OR REPLACE FUNCTION clean_expired_memory()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_memory
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONVERSATION STATE SUMMARY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_state (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  current_state TEXT NOT NULL,
  state_history TEXT[] DEFAULT '{}',
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  vehicle_context JSONB DEFAULT '{}',
  search_context JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create or replace function to update conversation state
CREATE OR REPLACE FUNCTION upsert_conversation_state(
  p_session_id TEXT,
  p_user_id TEXT DEFAULT NULL,
  p_new_state TEXT,
  p_vehicle_context JSONB DEFAULT '{}',
  p_search_context JSONB DEFAULT '{}',
  p_preferences JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO conversation_state (
    session_id,
    user_id,
    current_state,
    state_history,
    vehicle_context,
    search_context,
    preferences,
    last_interaction
  ) VALUES (
    p_session_id,
    p_user_id,
    p_new_state,
    ARRAY[p_new_state],
    p_vehicle_context,
    p_search_context,
    p_preferences,
    NOW()
  )
  ON CONFLICT (session_id) DO UPDATE
  SET
    current_state = p_new_state,
    state_history = array_append(conversation_state.state_history, p_new_state),
    vehicle_context = COALESCE(p_vehicle_context, conversation_state.vehicle_context),
    search_context = COALESCE(p_search_context, conversation_state.search_context),
    preferences = COALESCE(p_preferences, conversation_state.preferences),
    last_interaction = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- Daily intent statistics
CREATE OR REPLACE VIEW daily_intent_stats AS
SELECT
  DATE(created_at) as date,
  intent,
  COUNT(*) as count,
  AVG(confidence) as avg_confidence,
  AVG(execution_time) as avg_execution_time_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
FROM agent_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), intent
ORDER BY date DESC, count DESC;

-- Agent usage statistics
CREATE OR REPLACE VIEW agent_usage_stats AS
SELECT
  agent,
  COUNT(*) as total_calls,
  AVG(execution_time) as avg_execution_time_ms,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
  COUNT(DISTINCT user_id) as unique_users
FROM agent_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY agent
ORDER BY total_calls DESC;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Users can only see their own conversation history
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversation history"
  ON conversation_history FOR SELECT
  USING (
    user_id IS NULL OR
    user_id = (
      SELECT auth.uid() FROM auth.users WHERE auth.uid()::text = conversation_history.user_id::text
    ) OR
    session_id IN (
      SELECT session_id FROM conversation_state
      WHERE user_id = auth.uid()::text
    )
  );

-- Users can insert their own conversation history
CREATE POLICY "Users can insert own conversation history"
  ON conversation_history FOR INSERT
  WITH CHECK (true); -- Allow all for now, tighten in production

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Full-text search on conversation content
CREATE INDEX IF NOT EXISTS idx_conversation_content_fts
  ON conversation_history USING gin(to_tsvector('thai', content));

-- Composite index for analytics
CREATE INDEX IF NOT EXISTS idx_agent_logs_composite
  ON agent_logs(created_at DESC, intent, success);

-- GIN index for metadata searches
CREATE INDEX IF NOT EXISTS idx_conversation_metadata
  ON conversation_history USING GIN(metadata);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_state_updated_at
  BEFORE UPDATE ON conversation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE conversation_history IS 'Stores all conversation messages between users and AI agents';
COMMENT ON TABLE agent_logs IS 'Logs all agent interactions for analytics and debugging';
COMMENT ON TABLE promotions IS 'Active promotions and discounts';
COMMENT ON TABLE vehicle_compatibility IS 'Vehicle compatibility data for parts';
COMMENT ON TABLE agent_memory IS 'Persistent memory for AI agents across sessions';
COMMENT ON TABLE conversation_state IS 'Current state and context of ongoing conversations';

COMMENT ON VIEW daily_intent_stats IS 'Daily statistics of intent detection';
COMMENT ON VIEW agent_usage_stats IS 'Agent usage and performance metrics';


-- ========================================
-- END OF jetsetgo_008_agent_tables.sql
-- ========================================


