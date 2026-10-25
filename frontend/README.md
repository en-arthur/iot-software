# Relayboard frontend

Next.js (App Router) frontend for the ESP32 IoT extension board system. It uses
Supabase Auth and Row Level Security for login and reads, Supabase Realtime for
live updates, and the FastAPI backend only for relay commands and board claims.

Plain JavaScript only — no TypeScript.

## Stack

- Next.js 15 App Router
- `@supabase/supabase-js` + `@supabase/ssr` (cookie sessions)
- TanStack Query
- Tailwind CSS
- Recharts
- ESLint (`next/core-web-vitals`) + Prettier

## Requirements

- Node.js 18.18 or newer (Node 20+ recommended)
- npm
- A Supabase project
- The FastAPI backend running at `http://localhost:8000` (or another URL)

## Run locally

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Use only the Supabase **anon** key in this app. The service role key bypasses RLS
and must never be exposed to the browser or committed to the repo.

`NEXT_PUBLIC_*` variables are inlined at build time, so set them in your hosting
provider's build environment as well as locally. Changing `NEXT_PUBLIC_API_URL`
requires a rebuild.

## Supabase setup

### 1. Auth

Enable the Email provider in **Authentication → Providers**. If email
confirmation is enabled, add these redirect URLs in **Authentication → URL
Configuration**:

```text
http://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

The app includes `app/auth/callback/route.js`, which exchanges the Supabase PKCE
code for a cookie session. If email confirmation is disabled, registration signs
the user in immediately.

### 2. Row Level Security

The frontend only reads these tables. Enable RLS and add SELECT policies for the
owning user. Example SQL (adjust to match your existing policies):

```sql
alter table public.boards enable row level security;
alter table public.latest_readings enable row level security;
alter table public.relay_states enable row level security;
alter table public.readings enable row level security;

create policy "read own boards"
on public.boards for select
using (owner_id = auth.uid());

create policy "read latest readings for own boards"
on public.latest_readings for select
using (
  exists (
    select 1 from public.boards b
    where b.id = latest_readings.board_id
      and b.owner_id = auth.uid()
  )
);

create policy "read relay states for own boards"
on public.relay_states for select
using (
  exists (
    select 1 from public.boards b
    where b.id = relay_states.board_id
      and b.owner_id = auth.uid()
  )
);

create policy "read history for own boards"
on public.readings for select
using (
  exists (
    select 1 from public.boards b
    where b.id = readings.board_id
      and b.owner_id = auth.uid()
  )
);
```

The FastAPI backend is responsible for all writes and for claiming boards.

### 3. Realtime

Add only the live tables to the `supabase_realtime` publication:

```sql
alter publication supabase_realtime add table public.boards;
alter publication supabase_realtime add table public.latest_readings;
alter publication supabase_realtime add table public.relay_states;
```

Do **not** add `public.readings` to the publication. The frontend polls history
instead of subscribing to the high-volume raw table. Realtime respects RLS, so
the SELECT policies above are also required for live events.

## Backend contract

- `POST /boards/{id}/relays/{n}` with body `{ "state": "on" | "off" }` returns
  `202 Accepted`.
- `POST /boards/claim` with body `{ "board_id": "..." }` claims an unowned board.
- Both require `Authorization: Bearer <Supabase access token>`, which
  `lib/api.js` attaches automatically.

The browser calls the FastAPI URL from `NEXT_PUBLIC_API_URL`. Configure CORS on
the backend to allow the frontend origin (`http://localhost:3000` in
development).

## Assumptions

- `boards.status` is a lowercase `online` or `offline`. The badge and control
  lockout treat anything else as offline/unknown.
- `latest_readings` contains one row per board and sensor, and `relay_states`
  contains one row per board and relay. The UI renders a toggle per row, so the
  relay count is not hardcoded.
- Sensor values are numeric; non-numeric history rows are skipped in charts.
- Timestamps are ISO 8601 strings.
- `403` means **Not your board** and `409` means **Board is offline** when the
  backend does not return a more specific `detail` message. If your backend uses
  the opposite convention, adjust `messageForStatus` in `lib/api.js`.
- Board IDs are case-sensitive and are entered exactly as printed by the board.
- History requests are capped at 3000 rows and downsampled to at most 120 points
  per sensor. If your Supabase project's PostgREST row cap is lower, charts
  still work with the newest rows that are returned.
- The `readings` table has `board_id`, `sensor`, `value`, and `ts` columns.

## How it works

### Auth

- `lib/supabase/client.js` creates the browser client used by forms, the header,
  the API wrapper, and Realtime.
- `lib/supabase/server.js` creates a cookie-aware client for server components
  and the auth callback route.
- `middleware.js` refreshes the session on every request and redirects
  unauthenticated `/boards` requests to `/login?redirectTo=...`.
- Sign-out lives in the header and returns the user to `/login`.

### Data and Realtime

- `useBoards`, `useBoard`, and `useReadings` are the only data hooks.
- `RealtimeProvider` owns a single Supabase channel for `boards`,
  `latest_readings`, and `relay_states`. Each Postgres change is merged directly
  into the TanStack Query cache.
- On reconnect, the provider re-subscribes with exponential backoff and
  invalidates cached board data to recover events missed while disconnected.
- The header shows the connection state: **Live**, **Connecting**,
  **Reconnecting**, or **Offline**.

### Relay confirmation

1. The user clicks a toggle.
2. The frontend sends the command to FastAPI. The switch does **not** change
   optimistically.
3. The switch shows a pending state while it waits.
4. The checked value changes only when a `relay_states` Realtime event arrives
   with the new confirmed state.
5. If no confirmation arrives within 5 seconds, the pending state clears and an
   error is shown; the switch stays on the last confirmed value.

### History

`useReadings` requests the selected range (1h, 24h, 7d) with a row limit, groups
rows by sensor, downsamples each series, and polls periodically. The range
selector changes the query key, which triggers a fresh request. `SensorChart` is
loaded with `next/dynamic` and `ssr: false`.

## Scripts

```bash
npm run dev          # development server on port 3000
npm run build        # production build
npm run start        # production server
npm run lint         # ESLint (next/core-web-vitals)
npm run format       # Prettier write
npm run format:check # Prettier check
```

## Project layout

```text
frontend/
  app/
    layout.js
    page.js                 # redirects to /boards
    globals.css
    login/page.js
    register/page.js
    auth/callback/route.js  # Supabase email-confirmation callback
    boards/page.js
    boards/[id]/page.js
  components/
    AddBoardDialog.jsx
    AuthShell.jsx
    BoardCard.jsx
    BoardDetail.jsx
    BoardList.jsx
    EmptyBoards.jsx
    ErrorState.jsx
    Header.jsx
    Logo.jsx
    RelativeTime.jsx
    RelayToggle.jsx
    SensorChart.jsx
    Skeletons.jsx
    StatusBadge.jsx
    icons.jsx
    auth/LoginForm.jsx
    auth/RegisterForm.jsx
  hooks/
    useBoards.js
    useBoard.js
    useReadings.js
  lib/
    api.js
    auth-errors.js
    format.js
    readings.js
    supabase/client.js
    supabase/server.js
  providers/
    QueryProvider.js
    RealtimeProvider.js
  middleware.js
```

## Troubleshooting

- **"Missing Supabase environment variables"** — copy `.env.example` to
  `.env.local`, fill it in, and restart `npm run dev`.
- **Login succeeds but /boards redirects back to /login** — check that the
  Supabase URL/anon key are correct and that cookies are allowed for the origin.
- **No live updates** — verify the three tables are in the `supabase_realtime`
  publication, RLS SELECT policies exist, and the header says **Live**.
- **Relay command fails with "Not your board" or "Board is offline"** — the
  backend rejected the command; confirm ownership and `boards.status`.
- **Charts are empty** — confirm the range contains rows in `readings`, the
  timestamps are ISO strings, and values are numeric.
