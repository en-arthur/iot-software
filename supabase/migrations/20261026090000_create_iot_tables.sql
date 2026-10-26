-- 20261026090000_create_iot_tables.sql
-- Core tables for the Relayboard IoT backend.
--
-- Writes are performed exclusively by the FastAPI backend using the direct
-- Postgres connection (the `postgres` role). The browser only reads, and RLS
-- policies in the next migration restrict those reads to the board owner.

create table if not exists public.boards (
    id text primary key,
    name text,
    owner_id uuid references auth.users (id) on delete set null,
    status text not null default 'offline',
    last_seen timestamptz,
    created_at timestamptz not null default now(),
    constraint boards_status_check check (status in ('online', 'offline'))
);

-- Boards are looked up by owner in every ownership check.
create index if not exists boards_owner_id_idx on public.boards (owner_id);

create table if not exists public.readings (
    id bigserial primary key,
    board_id text not null references public.boards (id) on delete cascade,
    sensor text not null,
    value double precision not null,
    ts timestamptz not null default now()
);

-- Chart queries read the newest rows for one board + sensor.
create index if not exists readings_board_sensor_ts_idx
    on public.readings (board_id, sensor, ts desc);

-- The retention job deletes by ts, which the composite index above cannot serve
-- on its own.
create index if not exists readings_ts_idx on public.readings (ts);

create table if not exists public.latest_readings (
    board_id text not null references public.boards (id) on delete cascade,
    sensor text not null,
    value double precision not null,
    ts timestamptz not null,
    primary key (board_id, sensor)
);

create table if not exists public.relay_states (
    board_id text not null references public.boards (id) on delete cascade,
    relay_number integer not null,
    state text not null,
    updated_at timestamptz not null default now(),
    primary key (board_id, relay_number),
    constraint relay_states_relay_number_check check (relay_number > 0),
    constraint relay_states_state_check check (state in ('on', 'off'))
);

comment on table public.boards is
    'ESP32 boards. owner_id is null until a user claims the board.';
comment on table public.readings is
    'Raw sensor history, pruned by pg_cron after the retention window.';
comment on table public.latest_readings is
    'One row per board + sensor, kept in sync with the newest reading.';
comment on table public.relay_states is
    'Last relay state reported by the board. The board is the source of truth.';
