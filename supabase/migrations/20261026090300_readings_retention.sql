-- 20261026090400_readings_retention.sql
-- Deletes sensor history older than the retention window.
--
-- RETENTION IS CONFIGURABLE: change the interval below (default 90 days) and
-- re-run `supabase db push` / the SQL. Keep it in sync with any dashboard
-- expectations.
--
-- pg_cron runs in UTC. 03:15 UTC keeps the delete off the top of the hour.

create extension if not exists pg_cron;

-- Make the job idempotent: drop a previous version before scheduling.
do $$
begin
    perform cron.unschedule('delete-old-readings');
exception
    when others then
        -- Job did not exist yet.
        null;
end
$$;

select cron.schedule(
    'delete-old-readings',
    '15 3 * * *',
    $cron$
        delete from public.readings
        where ts < now() - interval '90 days';
    $cron$
);
