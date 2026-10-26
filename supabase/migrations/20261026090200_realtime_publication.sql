-- 20261026090200_realtime_publication.sql
-- The Next.js app subscribes to boards, latest_readings, and relay_states.
-- public.readings is intentionally excluded: it is high volume and the frontend
-- polls history instead of streaming it.
--
-- Safe to re-run. Every step is guarded, and a missing table raises an explicit
-- error instead of the bare "relation public.boards does not exist".

do $$
begin
    if to_regclass('public.boards') is null then
        raise exception
            'public.boards is missing - run 20261026090000_create_iot_tables.sql first';
    end if;

    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        execute 'create publication supabase_realtime';
    end if;

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
