-- Boonyang stock sync: run the sheet -> DB sync every hour.
--
-- The edge function writes only rows that changed, so an hour with no edits to the sheet costs
-- two small table reads and zero writes. The x-sync-secret header is read from Vault at run time
-- (secret name: boonyang_sync_secret) so it never appears in this file or in cron.job.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'boonyang-stock-sync';

select cron.schedule(
  'boonyang-stock-sync',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://cbxicbynxnprscwqnyld.supabase.co/functions/v1/boonyang-stock-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'boonyang_sync_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
