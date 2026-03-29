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
