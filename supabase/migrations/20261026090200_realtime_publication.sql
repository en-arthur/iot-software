-- 20261026090200_realtime_publication.sql
-- The Next.js app subscribes to boards, latest_readings, and relay_states.
-- public.readings is intentionally excluded: it is high volume and the frontend
-- polls history instead of streaming it.
--
-- The DO blocks make the migration safe to re-run on a project where the tables
-- were already added by hand.

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'boards'
    ) then
        execute 'alter publication supabase_realtime add table public.boards';
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'latest_readings'
    ) then
        execute 'alter publication supabase_realtime add table public.latest_readings';
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'relay_states'
    ) then
        execute 'alter publication supabase_realtime add table public.relay_states';
    end if;
end
$$;
