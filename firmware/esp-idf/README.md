# ESP32 firmware (ESP-IDF, C)

Native ESP-IDF port of the Arduino sketch. It speaks the same topic contract
and keeps its WiFi/broker settings in NVS instead of compiled-in constants.

```
boards/{id}/status            "online" / "offline"  (retained, LWT = offline)
boards/{id}/sensors/{name}    {"value":24.5,"ts":1700000000}
boards/{id}/relays/1/state    "on" / "off"
boards/{id}/relays/1/set      "on" / "off"          (subscribed, QoS 1)
```

## Layout

| File | Purpose |
| --- | --- |
| `main/app_config.c` | NVS load/seed, board settings |
| `main/wifi.c` | station mode, event handling, reconnect |
| `main/mqtt.c` | esp-mqtt client, LWT, topics, relay commands |
| `main/relays.c` | relay GPIO, active-high/low |
| `main/dht11.c` | self-contained bit-banged DHT11 driver |
| `main/main.c` | boot sequence and sensor loop |
| `main/Kconfig.projbuild` | `menuconfig` options |

## Requirements

- **ESP-IDF v5.x** (`idf.py` on `PATH`; source `export.sh` first)
- An ESP32 dev board
- DHT11 on GPIO 4 (10 kΩ pull-up to 3V3), relay/LED on GPIO 2
- Mosquitto reachable on the LAN at port 1883

## Configure

```bash
cd firmware/esp-idf
idf.py set-target esp32        # esp32s3 / esp32c3 / ... for other chips
idf.py menuconfig
```

Open **Relayboard** and set:

| Option | Example | Notes |
| --- | --- | --- |
| WiFi SSID | `YOUR_WIFI_NAME` | must reach the broker host |
| WiFi password | `YOUR_WIFI_PASSWORD` | |
| MQTT broker URI | `mqtt://192.168.1.50:1883` | LAN IP of the broker machine, **not** `localhost` |
| MQTT username | `relayboard` | must match `mosquitto/passwd` |
| MQTT password | `change-me` | |
| Board ID | `esp32-01` | claim this ID in the web app |
| Relay / LED GPIO | `2` | |
| Relay is active high | `y` | disable for active-low modules |
| DHT11 data GPIO | `4` | |
| Sensor publish interval | `10` | seconds (minimum 2) |

### NVS behaviour

On first boot the menuconfig values are written to NVS and NVS becomes the
source of truth. Editing `menuconfig` afterwards has no effect until NVS is
erased:

```bash
idf.py erase-flash && idf.py flash monitor
```

`erase-flash` wipes WiFi credentials and the board ID too, so the next boot
re-seeds everything from the current menuconfig values.

## Build and flash

```bash
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

Exit the monitor with `Ctrl+]`. Expected boot log:

```
I (312) app_config: board_id=esp32-01 broker=mqtt://192.168.1.50:1883
I (322) relays: relay on GPIO 2 (active high)
I (332) dht11: DHT11 on GPIO 4
I (512) wifi: connecting to "YOUR_WIFI_NAME"
I (2412) wifi: connected, ip=192.168.1.77
I (2512) mqtt: connecting to mqtt://192.168.1.50:1883 as relayboard-esp32-01
I (2712) mqtt: connected to broker
I (12900) main: temperature=26.3 humidity=58.0
```

## Broker setup

The broker is the local Mosquitto from the repository root. Create the shared
user once (or one user per board, see below):

```bash
mosquitto_passwd -c -b mosquitto/passwd relayboard change-me
chmod 600 mosquitto/passwd
mosquitto -c mosquitto/mosquitto.conf -v
```

The same credentials go in `.env` (`MQTT_USERNAME`, `MQTT_PASSWORD`) and in
`menuconfig`.

### Optional: one user per board

`mosquitto_passwd` without `-c` appends:

```bash
mosquitto_passwd -b mosquitto/passwd esp32-01 board-secret-1
```

Then set `MQTT username = esp32-01`, `MQTT password = board-secret-1` in
`menuconfig` for that board. Per-board users let you revoke one board's
credentials, but without an `acl_file` every authenticated user can still
publish to any `boards/...` topic. Add broker ACLs if you need that isolation;
the backend's ownership checks only protect the REST API.

## Test end to end

1. Start Mosquitto and the backend (see the root `README.md`).
2. Power/flash the board and watch it publish `online`.
3. Claim the board (web app → Add board, or curl):

```bash
curl -X POST http://localhost:8000/boards/claim \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"board_id":"esp32-01"}'
```

4. Watch telemetry and commands from another terminal:

```bash
mosquitto_sub -h localhost -u relayboard -P change-me -v -t 'boards/esp32-01/#'
```

5. Toggle relay 1 in the UI. The backend publishes on
   `boards/esp32-01/relays/1/set`; the board switches the GPIO and replies on
   `boards/esp32-01/relays/1/state`.
6. Unplug the board. The broker publishes the retained LWT `offline` once the
   30 s keepalive expires (about 45 s), and the backend marks the board
   offline.

## Notes

- Plain MQTT on 1883, matching the repository's Mosquitto config. Use
  `mqtts://...` only if you add TLS to the broker.
- Status is retained, the LWT is retained, sensor and relay-state messages are
  not. The backend does not depend on retained telemetry.
- Sensor publishes use QoS 0 (telemetry is replaceable). Commands are
  subscribed at QoS 1.
- The DHT11 is read at most once per interval and never faster than 2 s.
- `sdkconfig.defaults` disables the newlib nano formatter so the `%f` / `%lld`
  calls in sensor payloads and logs work on every target.
- One board = one `BOARD_ID`; two boards with the same ID overwrite each
  other's rows.
- `idf.py monitor` is the easiest way to see reconnect behaviour: kill the
  broker or the AP and watch esp-mqtt/WiFi retry.

## Adding another sensor

`mqtt_publish_sensor("name", value)` publishes to
`boards/{board_id}/sensors/name` with a timestamp, and the backend creates the
sensor automatically. For example, after an ADC or I2C read in `main.c`:

```c
mqtt_publish_sensor("soil_moisture", 42.5f);
```

Keep the name URL/path friendly (`[A-Za-z0-9._:-]`).
