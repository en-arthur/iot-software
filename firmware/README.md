# ESP32 firmware

Two implementations of the same device contract. Pick one:

| Variant | Directory | Use it when |
| --- | --- | --- |
| Arduino | [`esp32_relayboard/`](esp32_relayboard/) | quickest to flash; settings are `const char *` at the top of the sketch |
| ESP-IDF (C) | [`esp-idf/`](esp-idf/) | you want `menuconfig` + NVS-stored settings and the native `esp-mqtt` stack |

Both publish DHT11 telemetry and listen for relay commands on the backend's
topic contract. This is the device side of the system; the backend and
Mosquitto run on your machine. The rest of this page documents the Arduino
variant; see [`esp-idf/README.md`](esp-idf/README.md) for the ESP-IDF one.

## Wiring

| Signal | ESP32 pin | Notes |
| --- | --- | --- |
| DHT11 data | GPIO 4 | 10 kΩ pull-up to 3V3, VCC 3V3, GND |
| Relay / LED | GPIO 2 | onboard LED on most dev boards; use a relay module on 3V3/5V + GND |
| Relay type | — | set `RELAY_ACTIVE_HIGH` to `false` for active-low modules |

## Network requirements

```
ESP32 --WiFi--> router --LAN--> laptop (Mosquitto :1883) <-- backend
                                    |
                                    +-- internet --> Supabase
```

- The board must join the **same WiFi/LAN** as the machine running Mosquitto.
- `MQTT_HOST` must be that machine's LAN IP (`hostname -I`, `ip addr`, or
  `ipconfig`). `localhost` on the ESP32 points at the board itself.
- Allow inbound TCP 1883 on the broker machine's firewall.
- The board does **not** need internet access; your laptop does, for Supabase.
- If the broker is on another network, expose it (VPN/tunnel) or move the
  backend + broker to a host the board can reach.

## Configure

Edit the top of `esp32_relayboard.ino`:

```cpp
const char *WIFI_SSID = "...";
const char *WIFI_PASSWORD = "...";

const char *MQTT_HOST = "192.168.1.50";   // your laptop
const uint16_t MQTT_PORT = 1883;
const char *MQTT_USER = "relayboard";
const char *MQTT_PASSWORD = "change-me";

const char *BOARD_ID = "esp32-01";        // unique per board
```

`MQTT_USER` / `MQTT_PASSWORD` must match `mosquitto/passwd` and `.env`.

## Flash

1. Arduino IDE → Boards Manager → install **esp32**.
2. Library Manager → install **PubSubClient** (Nick O'Leary), **DHT sensor
   library** (Adafruit), and **Adafruit Unified Sensor**.
3. Select **ESP32 Dev Module**, pick the port, upload.
4. Open the Serial Monitor at **115200**. You should see:

```
Relayboard board_id=esp32-01
MAC: AA:BB:CC:DD:EE:FF
Connecting to WiFi "..."....
WiFi connected, IP: 192.168.1.77
MQTT connecting to 192.168.1.50:1883 ... connected
```

## Test end to end

1. Start Mosquitto and the backend (see the root README).
2. Power the board. It publishes a retained `boards/esp32-01/status = online`
   and its sensor values every 10 s.
3. Claim it (web app → Add board, or curl):

```bash
curl -X POST http://localhost:8000/boards/claim \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"board_id":"esp32-01"}'
```

4. Toggle relay 1 in the UI. Watch the command arrive and the board confirm:

```bash
mosquitto_sub -h localhost -u relayboard -P change-me -v -t 'boards/esp32-01/relays/+/set'
mosquitto_sub -h localhost -u relayboard -P change-me -v -t 'boards/esp32-01/relays/+/state'
```

5. Unplug the board. The broker publishes the retained LWT `offline` once the
   30 s keepalive expires (about 45 s), and the backend marks the board
   offline.

## Notes

- PubSubClient publishes at QoS 0 (telemetry and state reports). It subscribes
  at QoS 1, so backend commands arrive at QoS 1. If you need QoS 1 publishes,
  swap in the `arduino-mqtt` library.
- The backend batches readings (200 ms / 100 rows), so a 10 s interval is
  plenty. Publishing faster than ~10 Hz is wasteful on a DHT11.
- Status is retained so the backend sees `online` even if it starts after the
  board. The LWT is also retained, so an ungraceful disconnect marks it offline.
- One board = one `BOARD_ID`. Two boards with the same ID will overwrite each
  other's rows.
