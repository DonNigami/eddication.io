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
