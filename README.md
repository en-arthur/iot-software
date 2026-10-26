# Relayboard backend

FastAPI service that bridges ESP32 boards on MQTT to Supabase Postgres. It is
the only component that talks to the broker: it ingests board telemetry, keeps
the database current, and publishes relay commands requested by the Next.js app.

The web app lives in [`frontend/`](frontend/README.md) and expects
`NEXT_PUBLIC_API_URL=http://localhost:8000` in development.

There are no login endpoints and no WebSocket. The browser authenticates with
Supabase Auth and reads the tables directly; this service validates the same
Supabase access token on write endpoints.

```
ESP32 --MQTT--> Mosquitto <--MQTT--> FastAPI backend --SQL--> Supabase Postgres
                                          ^                        ^
                                          | Bearer token           | reads + Realtime
                                     Next.js web app --------------+
```

## Repository layout

```
backend/
  app/
    main.py            FastAPI app + lifespan (MQTT task, batcher)
    config.py          pydantic-settings
    db.py              async engine/session, pooler handling
    models.py          SQLModel tables
    auth.py            Supabase JWT verification
    ownership.py       board ownership rule
    mqtt.py            listener, reconnect loop, publisher queue
    topics.py          topic + payload parsers
    batching.py        reading batch writer
    routers/           boards.py, health.py
  tests/
  requirements.txt
  requirements-dev.txt
  pyproject.toml       ruff config
supabase/migrations/   schema, RLS, Realtime, retention
mosquitto/             broker config + password file (git-ignored)
firmware/              ESP32 firmware: Arduino sketch + ESP-IDF (C) project
.env.example
```

## 1. Supabase setup

1. Create a Supabase project and note the project ref, database password, and
   project URL.
2. Apply the migrations in `supabase/migrations/` **in filename order**. With the
   [Supabase CLI](https://supabase.com/docs/guides/cli):

   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase db push
   ```

   Or paste each file into the SQL editor:

   | File | What it does |
   | --- | --- |
   | `..._create_iot_tables.sql` | tables, constraints, indexes |
   | `..._enable_rls.sql` | RLS + SELECT-only policies for `authenticated` |
   | `..._realtime_publication.sql` | adds `boards`, `latest_readings`, `relay_states` |
   | `..._readings_retention.sql` | pg_cron job deleting readings older than 90 days |

3. `pg_cron` must be available (it is enabled by default on Supabase). The
   retention window is the `interval '90 days'` literal in
   `20261026090300_readings_retention.sql`; change it there and re-apply to tune
   it. To change it without editing the migration:

   ```sql
   select cron.unschedule('delete-old-readings');
   select cron.schedule(
     'delete-old-readings',
     '15 3 * * *',
     $$delete from public.readings where ts < now() - interval '30 days'$$
   );
   ```

### Auth keys

The backend verifies Supabase access tokens locally:

- **New projects (asymmetric, ES256/RS256):** leave `SUPABASE_JWT_SECRET` empty.
  Keys are fetched from
  `https://YOUR-PROJECT.supabase.co/auth/v1/.well-known/jwks.json` and cached
  for an hour (refreshed immediately when an unknown `kid` appears).
- **Legacy projects (HS256):** set `SUPABASE_JWT_SECRET` to the project's JWT
  secret. The secret path takes precedence when both are configured.

Audience (`authenticated`) and issuer (`https://YOUR-PROJECT.supabase.co/auth/v1`)
are verified as well.

## 2. Configuration

```bash
cp .env.example .env
```

Fill in `DATABASE_URL`, `SUPABASE_URL`, and either the JWT secret or the JWKS
URL. `CORS_ORIGINS` defaults to `http://localhost:3000`.

`DATABASE_URL` may be the direct connection (`db.<ref>.supabase.co:5432`) or a
pooler URL. If you use the **transaction pooler on port 6543**, the backend
detects it and sets `statement_cache_size=0` automatically (a URL query
`statement_cache_size=...` or `pgbouncer=true` also triggers it).

## 3. Mosquitto credentials

Install the broker and its CLI tools:

```bash
# Debian / Ubuntu
sudo apt install mosquitto mosquitto-clients

# macOS
brew install mosquitto
```

The broker requires a username and password. Generate the password file once
from the repository root:

```bash
mosquitto_passwd -c -b mosquitto/passwd relayboard change-me
chmod 600 mosquitto/passwd
```

Use the same values in `.env`:

```dotenv
MQTT_USERNAME=relayboard
MQTT_PASSWORD=change-me
```

`mosquitto/passwd` is git-ignored. For firmware, flash the same credentials.

## 4. Run

### Start the broker

If the packaged Mosquitto service is running it already owns port 1883, so stop
it first:

```bash
sudo systemctl stop mosquitto     # Debian/Ubuntu, only if it is installed as a service
```

Then start the repo's config from the repository root and leave it running:

```bash
mosquitto -c mosquitto/mosquitto.conf -v
```

The broker listens on `localhost:1883`.

### Start the backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
```

The backend listens on <http://localhost:8000> and reads the repo-root `.env`
(`../.env`). Interactive API docs: <http://localhost:8000/docs>.

## MQTT contract

| Topic | Direction | Payload | Handling |
| --- | --- | --- | --- |
| `boards/{board_id}/status` | board → backend | `online` / `offline` (retained, last will) | updates `boards.status`, `boards.last_seen` |
| `boards/{board_id}/sensors/{name}` | board → backend | `{"value": 24.5, "ts": 1700000000}` | batched insert into `readings` + upsert `latest_readings` |
| `boards/{board_id}/relays/{n}/state` | board → backend | `on` / `off` | upsert `relay_states` |
| `boards/{board_id}/relays/{n}/set` | backend → board | `on` / `off`, QoS 1 | published by `POST /boards/{id}/relays/{n}` |

Malformed topics or payloads are logged and dropped; the listener never crashes.
Unknown board IDs are auto-created with `owner_id = null` and `name = id`.

### Device firmware

Two variants implement this contract on an ESP32 (DHT11 + one relay/LED):

- `firmware/esp32_relayboard/esp32_relayboard.ino` — Arduino sketch, settings as
  constants at the top of the file. Fastest path to a first flash.
- `firmware/esp-idf/` — ESP-IDF v5.x project in C. Uses `esp-mqtt`, stores WiFi
  and broker settings in NVS (seeded from `idf.py menuconfig` on first boot),
  and reconnects WiFi/MQTT automatically.

Either way, the board joins your WiFi and connects to Mosquitto at the **LAN IP**
of the machine running the broker — `localhost` on the ESP32 means the board
itself. See [`firmware/README.md`](firmware/README.md) for the variant overview,
wiring, and the Arduino flow, and
[`firmware/esp-idf/README.md`](firmware/esp-idf/README.md) for menuconfig, NVS,
and flashing.

If you are testing without hardware, `mosquitto_pub` is enough: it plays the
part of the board and needs no WiFi.

## API

All board endpoints require `Authorization: Bearer <Supabase access token>`.

### `POST /boards/{id}/relays/{n}` → `202`

```json
{ "state": "on" }
```

- `404` board does not exist
- `403` board belongs to another user
- `409` board is not `online`
- `503` MQTT is disconnected or the publish timed out

The response is only an acknowledgement. The relay's new state is written when
the board publishes `.../relays/{n}/state`, which the frontend receives over
Supabase Realtime. The backend never writes `relay_states` on command.

### `POST /boards/claim` → `200`

```json
{ "board_id": "esp32-01" }
```

Sets `owner_id` only when it is currently null. `404` unknown board, `409`
already claimed (including by the same user).

### `GET /health`

Always returns `200` so monitors can read the body:

```json
{
  "status": "ok",
  "database": { "connected": true, "error": null },
  "mqtt": {
    "connected": true,
    "client_id": "relayboard-backend-1a2b3c4d",
    "topic_prefix": "boards",
    "last_error": null,
    "last_message_at": "2026-10-26T12:00:00+00:00",
    "last_connected_at": "2026-10-26T11:59:00+00:00",
    "reconnect_count": 0,
    "messages_processed": 42,
    "pending_publishes": 0
  },
  "timestamp": "2026-10-26T12:00:01+00:00"
}
```

`status` is `degraded` when either dependency is down.

## Testing manually

Get an access token (email/password sign-in; use the **anon** key):

```bash
export SUPABASE_URL=https://YOUR-PROJECT.supabase.co
export SUPABASE_ANON_KEY=your-anon-key

TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}' | jq -r .access_token)
```

Publish telemetry (the backend auto-creates `esp32-01`):

```bash
mosquitto_pub -h localhost -u relayboard -P change-me -r \
  -t boards/esp32-01/status -m online

mosquitto_pub -h localhost -u relayboard -P change-me \
  -t boards/esp32-01/sensors/temperature \
  -m '{"value": 24.5, "ts": 1700000000}'

mosquitto_pub -h localhost -u relayboard -P change-me \
  -t boards/esp32-01/relays/1/state -m on
```

Watch what the backend publishes:

```bash
mosquitto_sub -h localhost -u relayboard -P change-me -v -t 'boards/+/relays/+/set'
```

Claim the board, then toggle a relay:

```bash
curl -s -X POST http://localhost:8000/boards/claim \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"board_id":"esp32-01"}' | jq

curl -s -X POST http://localhost:8000/boards/esp32-01/relays/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"on"}' | jq

curl -s http://localhost:8000/health | jq
```

The relay call returns `409` unless the board has published `online`.

## Tests

```bash
cd backend
.venv/bin/python -m pytest
.venv/bin/ruff check app tests
.venv/bin/ruff format --check app tests
```

Covers the topic/payload parser (valid, malformed, edge cases), JWT verification
(valid, expired, wrong audience/issuer/signature), ownership rules, the relay
endpoint with a mocked MQTT service, claiming, and health. Tests use an in-memory
SQLite database and never touch Supabase or a broker.

## Assumptions

- **Board IDs** match `[A-Za-z0-9._:-]{1,128}` and are case-sensitive.
- **Relay numbers** are 1-based, `1..999`. The limit is a sanity bound, not a
  hardware limit.
- **Sensor payloads** must be JSON objects with a numeric `value`. `ts` is unix
  seconds (milliseconds are detected), an ISO 8601 string, or omitted. Missing or
  implausible timestamps (before 2000, or more than a day in the future) fall
  back to the receive time so a board with a broken clock cannot poison history.
- **`last_seen`** is set to the receive time for both `online` and `offline`
  messages. `status` is only changed by status messages; a sensor message alone
  does not mark a board online.
- **Auto-created boards** get `name = id`, `status = 'offline'`, `owner_id = null`.
- **Health** always returns HTTP 200; the `status` field carries the verdict.
- **RLS**: the backend connects as the table owner (`postgres` role) and is not
  subject to RLS. Browser clients only get SELECT policies, so all writes go
  through this service.
- **Batching**: readings flush every 200 ms or at 100 rows, whichever comes first.
  `latest_readings` is upserted in the same transaction and never moves backwards
  in time.
- **Publishing** is QoS 1 and non-retained. Commands are queued and the handler
  waits for the broker to accept the publish (default 5 s) before returning 202.
- **Timestamps** are stored and returned in UTC.

## Troubleshooting

- `Missing Supabase environment variables` in the frontend, or 503 from
  `/health` with `database.connected: false` — check `.env` / `DATABASE_URL`.
  Direct connections need the database password; pooler URLs need the pooler
  password.
- `asyncpg` prepared-statement errors behind PgBouncer — use the port 6543 URL
  (auto-detected) or append `?statement_cache_size=0`.
- `409 Board is offline` — the board has not published a retained `online`
  status. Publish one with `mosquitto_pub -r`.
- Realtime updates missing in the UI — confirm the tables are in the
  `supabase_realtime` publication and that the user's SELECT policies match
  `boards.owner_id = auth.uid()`.
- `mosquitto: Address already in use` — the packaged Mosquitto service is still
  running. Stop it (`sudo systemctl stop mosquitto`) or change the listener port.
- Mosquitto refuses to start because the password file is missing — run the
  `mosquitto_passwd` command above from the repository root.
