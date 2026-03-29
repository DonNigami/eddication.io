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
