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
