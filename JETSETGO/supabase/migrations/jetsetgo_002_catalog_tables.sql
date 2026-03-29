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
