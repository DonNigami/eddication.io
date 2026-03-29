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
