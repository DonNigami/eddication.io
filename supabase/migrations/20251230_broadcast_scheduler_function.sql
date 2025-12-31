-- Create a database function to mark broadcasts as ready to process
-- This function is called by an external service (Edge Function, Node.js backend, or cron job)
CREATE OR REPLACE FUNCTION get_pending_broadcasts()
RETURNS TABLE (
  id UUID,
  target TEXT,
  msg_type TEXT,
  message TEXT,
  image_url TEXT,
  flex_json JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.target,
    b.msg_type,
    b.message,
    b.image_url,
    b.flex_json,
    b.scheduled_at
  FROM broadcast_queue b
  WHERE b.status = 'scheduled' 
    AND b.scheduled_at <= NOW()
  ORDER BY b.scheduled_at ASC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark a broadcast as sent
CREATE OR REPLACE FUNCTION mark_broadcast_sent(broadcast_id UUID, success BOOLEAN DEFAULT true)
RETURNS void AS $$
BEGIN
  UPDATE broadcast_queue 
  SET 
    status = CASE WHEN success THEN 'sent' ELSE 'error' END,
    updated_at = NOW()
  WHERE id = broadcast_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pending_broadcasts() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mark_broadcast_sent(UUID, BOOLEAN) TO authenticated, anon;
