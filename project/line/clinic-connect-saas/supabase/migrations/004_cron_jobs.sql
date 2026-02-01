-- =====================================================
-- CLINIC CONNECT SAAS - CRON JOBS
-- Migration: 004_cron_jobs
-- Date: 2025-02-01
-- =====================================================

-- -----------------------------------------------------
-- ENABLE PG_CRON EXTENSION
-- -----------------------------------------------------
-- Note: pg_cron is already available in Supabase
-- If needed, uncomment: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------
-- CRON JOBS FOR EDGE FUNCTIONS
-- -----------------------------------------------------
-- Format: cron.schedule(schedule_name, cron_expression, task)

-- 1. Daily Queue Initialization - Every day at 00:01
SELECT cron.schedule(
    'daily-queue-init',
    '1 0 * * *', -- 00:01 daily
    $$
    SELECT
        net.http_post(
            url := 'https://xklcronrzcervtjnodzs.supabase.co/functions/v1/daily-queue-init',
            headers := '{"Authorization": "Bearer clinic_cron_secret_2025_xklcronrzcervtjnodzs", "Content-Type": "application/json"}'::jsonb,
            body := '{"date": "' || CURRENT_DATE || '"}'::jsonb
        );
    $$
);

-- 2. Appointment Reminder (Morning) - Every day at 08:00
SELECT cron.schedule(
    'appointment-reminder-morning',
    '0 8 * * *', -- 08:00 daily
    $$
    SELECT
        net.http_post(
            url := 'https://xklcronrzcervtjnodzs.supabase.co/functions/v1/appointment-reminder',
            headers := '{"Authorization": "Bearer clinic_cron_secret_2025_xklcronrzcervtjnodzs", "Content-Type": "application/json"}'::jsonb,
            body := '{"date": "' || CURRENT_DATE || '"}'::jsonb
        );
    $$
);

-- 3. Appointment Reminder (Afternoon) - Every day at 17:00
SELECT cron.schedule(
    'appointment-reminder-afternoon',
    '0 17 * * *', -- 17:00 daily
    $$
    SELECT
        net.http_post(
            url := 'https://xklcronrzcervtjnodzs.supabase.co/functions/v1/appointment-reminder',
            headers := '{"Authorization": "Bearer clinic_cron_secret_2025_xklcronrzcervtjnodzs", "Content-Type": "application/json"}'::jsonb,
            body := '{"date": "' || CURRENT_DATE || '"}'::jsonb
        );
    $$
);

-- 4. Queue Reminder - Every 15 minutes
SELECT cron.schedule(
    'queue-reminder',
    '*/15 * * * *', -- Every 15 minutes
    $$
    SELECT
        net.http_post(
            url := 'https://xklcronrzcervtjnodzs.supabase.co/functions/v1/queue-reminder',
            headers := '{"Authorization": "Bearer clinic_cron_secret_2025_xklcronrzcervtjnodzs", "Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb
        );
    $$
);

-- 5. Daily Report - Every day at 20:00
SELECT cron.schedule(
    'daily-report',
    '0 20 * * *', -- 20:00 daily
    $$
    SELECT
        net.http_post(
            url := 'https://xklcronrzcervtjnodzs.supabase.co/functions/v1/daily-report',
            headers := '{"Authorization": "Bearer clinic_cron_secret_2025_xklcronrzcervtjnodzs", "Content-Type": "application/json"}'::jsonb,
            body := '{"date": "' || CURRENT_DATE || '"}'::jsonb
        );
    $$
);

-- 6. Cleanup Old Logs - Weekly on Sunday at 02:00
SELECT cron.schedule(
    'cleanup-old-logs',
    '0 2 * * 0', -- 02:00 every Sunday
    $$
    -- Delete message logs older than 90 days
    DELETE FROM message_logs
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete old queue reminders (keep 30 days)
    DELETE FROM queue_reminders
    WHERE created_at < NOW() - INTERVAL '30 days';

    -- Delete old appointment reminders (keep 30 days)
    DELETE FROM appointment_reminders
    WHERE created_at < NOW() - INTERVAL '30 days';

    SELECT 'Cleanup completed' as result;
    $$
);

-- -----------------------------------------------------
-- VIEW TO LIST ALL CRON JOBS
-- -----------------------------------------------------
CREATE OR REPLACE VIEW active_cron_jobs AS
SELECT
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    active,
    jobname
FROM cron.job;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
