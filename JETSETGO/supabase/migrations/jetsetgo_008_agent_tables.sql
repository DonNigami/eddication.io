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
