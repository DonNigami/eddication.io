-- Create news_metrics table
CREATE TABLE IF NOT EXISTS news_metrics (
    id BIGSERIAL PRIMARY KEY,
    news_id UUID NOT NULL REFERENCES news_promotions(id) ON DELETE CASCADE,
    event TEXT NOT NULL CHECK (event IN ('view', 'click')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_metrics_news_id ON news_metrics(news_id);
CREATE INDEX IF NOT EXISTS idx_news_metrics_created_at ON news_metrics(created_at);

-- Create broadcast_queue table
CREATE TABLE IF NOT EXISTS broadcast_queue (
    id BIGSERIAL PRIMARY KEY,
    target TEXT NOT NULL,
    msg_type TEXT NOT NULL,
    message TEXT,
    image_url TEXT,
    flex_json TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_scheduled_at ON broadcast_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON broadcast_queue(status);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    detail JSONB,
    actor UUID REFERENCES profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Create points_history table
CREATE TABLE IF NOT EXISTS points_history (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    before_points INT DEFAULT 0,
    after_points INT DEFAULT 0,
    reason TEXT,
    actor UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_history_profile_id ON points_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_points_history_created_at ON points_history(created_at);

-- Enable RLS if needed
ALTER TABLE news_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read for authenticated" ON news_metrics;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON news_metrics;
DROP POLICY IF EXISTS "Allow update for authenticated" ON news_metrics;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON news_metrics;

DROP POLICY IF EXISTS "Allow read for authenticated" ON broadcast_queue;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON broadcast_queue;
DROP POLICY IF EXISTS "Allow update for authenticated" ON broadcast_queue;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON broadcast_queue;

DROP POLICY IF EXISTS "Allow read for authenticated" ON audit_logs;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON audit_logs;
DROP POLICY IF EXISTS "Allow update for authenticated" ON audit_logs;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON audit_logs;

DROP POLICY IF EXISTS "Allow read for authenticated" ON points_history;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON points_history;
DROP POLICY IF EXISTS "Allow update for authenticated" ON points_history;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON points_history;

-- RLS Policies - Allow all operations for authenticated users
CREATE POLICY "Allow read for authenticated" ON news_metrics FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON news_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON news_metrics FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON news_metrics FOR DELETE USING (true);

CREATE POLICY "Allow read for authenticated" ON broadcast_queue FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON broadcast_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON broadcast_queue FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON broadcast_queue FOR DELETE USING (true);

CREATE POLICY "Allow read for authenticated" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON audit_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON audit_logs FOR DELETE USING (true);

CREATE POLICY "Allow read for authenticated" ON points_history FOR SELECT USING (true);
CREATE POLICY "Allow insert for authenticated" ON points_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated" ON points_history FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated" ON points_history FOR DELETE USING (true);
