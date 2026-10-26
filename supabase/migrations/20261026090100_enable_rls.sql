-- 20261026090100_enable_rls.sql
-- Row Level Security: authenticated users may read only the rows that belong to
-- their own boards. There are deliberately no INSERT/UPDATE/DELETE policies, so
-- browser clients cannot write. The backend connects as the table owner
-- (postgres role) and bypasses RLS.
--
-- Safe to re-run: the policies are dropped before being recreated.

do $$
begin
    if to_regclass('public.boards') is null then
        raise exception
            'public.boards is missing - run 20261026090000_create_iot_tables.sql first';
    end if;
end
$$;

alter table public.boards enable row level security;
alter table public.readings enable row level security;
alter table public.latest_readings enable row level security;
alter table public.relay_states enable row level security;

-- SELECT: own boards only.
drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own"
on public.boards
for select
to authenticated
using (owner_id = (select auth.uid()));

-- SELECT: child rows whose board is owned by the caller.
drop policy if exists "readings_select_own" on public.readings;
create policy "readings_select_own"
on public.readings
for select
to authenticated
using (
    exists (
        select 1
        from public.boards b
        where b.id = readings.board_id
          and b.owner_id = (select auth.uid())
    )
);

drop policy if exists "latest_readings_select_own" on public.latest_readings;
create policy "latest_readings_select_own"
on public.latest_readings
for select
to authenticated
using (
    exists (
        select 1
        from public.boards b
        where b.id = latest_readings.board_id
          and b.owner_id = (select auth.uid())
    )
);

drop policy if exists "relay_states_select_own" on public.relay_states;
create policy "relay_states_select_own"
on public.relay_states
for select
to authenticated
using (
    exists (
        select 1
        from public.boards b
        where b.id = relay_states.board_id
          and b.owner_id = (select auth.uid())
    )
);

-- Keep the grants explicit; RLS still limits the rows that are visible.
grant select on public.boards to authenticated;
grant select on public.readings to authenticated;
grant select on public.latest_readings to authenticated;
grant select on public.relay_states to authenticated;
