/*
 * Relayboard ESP32 firmware (Arduino / ESP32 core)
 *
 * Talks to a local Mosquitto broker using the backend's topic contract:
 *
 *   boards/{id}/status            "online" / "offline" (retained, LWT = offline)
 *   boards/{id}/sensors/{name}    {"value": 24.5, "ts": 1700000000}
 *   boards/{id}/relays/{n}/state  "on" / "off"
 *   boards/{id}/relays/{n}/set    "on" / "off"   (subscribed, QoS 1)
 *
 * Libraries (Arduino IDE -> Library Manager):
 *   - PubSubClient (Nick O'Leary)
 *   - DHT sensor library (Adafruit) + Adafruit Unified Sensor
 *
 * Board: "ESP32 Dev Module". See firmware/README.md for wiring and testing.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <time.h>
#include "DHT.h"

// ---------------------------------------------------------------------------
// WiFi - the ESP32 must be on the same network as the Mosquitto broker.
// ---------------------------------------------------------------------------
const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---------------------------------------------------------------------------
// MQTT - LAN IP of the machine running Mosquitto. "localhost" will NOT work
// from the board. Find it with `hostname -I` (Linux) or `ipconfig` (Windows).
// ---------------------------------------------------------------------------
const char *MQTT_HOST = "192.168.1.50";
const uint16_t MQTT_PORT = 1883;
const char *MQTT_USER = "relayboard";
const char *MQTT_PASSWORD = "change-me";

// ---------------------------------------------------------------------------
// Board identity - must be unique and is what you claim in the web app.
// ---------------------------------------------------------------------------
const char *BOARD_ID = "esp32-01";

// ---------------------------------------------------------------------------
// Hardware
// ---------------------------------------------------------------------------
#define RELAY_COUNT 1
const uint8_t RELAY_PINS[RELAY_COUNT] = {2};  // GPIO2 = onboard LED on many dev boards
const bool RELAY_ACTIVE_HIGH = true;          // set false for active-low relay modules

#define DHTPIN 4
#define DHTTYPE DHT11

// How often sensor values are published (DHT11 needs >= 2 s between reads).
const unsigned long SENSOR_INTERVAL_MS = 10000;
const unsigned long RECONNECT_INTERVAL_MS = 5000;

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
WiFiClient net;
PubSubClient client(net);
DHT dht(DHTPIN, DHTTYPE);

char topicStatus[96];
char topicSensor[96];
char relaySetTopics[RELAY_COUNT][96];

bool relayOn[RELAY_COUNT] = {false};
unsigned long lastSensorAt = 0;
unsigned long lastReconnectAt = 0;
unsigned long lastWifiAttemptAt = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
void buildTopics() {
  snprintf(topicStatus, sizeof(topicStatus), "boards/%s/status", BOARD_ID);
  snprintf(topicSensor, sizeof(topicSensor), "boards/%s/sensors/", BOARD_ID);
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    snprintf(relaySetTopics[i], sizeof(relaySetTopics[i]),
             "boards/%s/relays/%u/set", BOARD_ID, i + 1);
  }
}

void setRelay(uint8_t index, bool on) {
  relayOn[index] = on;
  bool level = RELAY_ACTIVE_HIGH ? on : !on;
  digitalWrite(RELAY_PINS[index], level ? HIGH : LOW);
}

void publishStatus(const char *status) {
  // Retained so the backend and late subscribers see the current state.
  client.publish(topicStatus, status, true);
}

void publishRelayState(uint8_t relayNumber) {
  char topic[96];
  snprintf(topic, sizeof(topic), "boards/%s/relays/%u/state", BOARD_ID, relayNumber);
  client.publish(topic, relayOn[relayNumber - 1] ? "on" : "off");
}

void publishSensor(const char *name, float value) {
  char topic[96];
  char payload[80];

  snprintf(topic, sizeof(topic), "%s%s", topicSensor, name);

  time_t now = time(nullptr);
  if (now > 1700000000) {
    snprintf(payload, sizeof(payload), "{\"value\":%.1f,\"ts\":%ld}", value, (long)now);
  } else {
    // Clock not synced yet; the backend falls back to receive time.
    snprintf(payload, sizeof(payload), "{\"value\":%.1f}", value);
  }

  client.publish(topic, payload);
}

// ---------------------------------------------------------------------------
// MQTT
// ---------------------------------------------------------------------------
void onMessage(char *topic, byte *payload, unsigned int length) {
  String message;
  message.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();
  message.toLowerCase();

  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    if (strcmp(topic, relaySetTopics[i]) != 0) continue;

    bool on = message == "on";
    setRelay(i, on);
    publishRelayState(i + 1);
    Serial.printf("Relay %u -> %s\n", i + 1, on ? "on" : "off");
    return;
  }

  Serial.printf("Ignoring message on %s\n", topic);
}

void connectMqtt() {
  if (client.connected()) return;

  unsigned long now = millis();
  if (now - lastReconnectAt < RECONNECT_INTERVAL_MS) return;
  lastReconnectAt = now;

  char clientId[48];
  snprintf(clientId, sizeof(clientId), "relayboard-%s", BOARD_ID);

  Serial.printf("MQTT connecting to %s:%u ... ", MQTT_HOST, MQTT_PORT);

  // Last will: the broker publishes "offline" (retained) if the board vanishes.
  if (client.connect(clientId, MQTT_USER, MQTT_PASSWORD, topicStatus, 1, true, "offline")) {
    Serial.println("connected");

    publishStatus("online");
    for (uint8_t i = 0; i < RELAY_COUNT; i++) {
      client.subscribe(relaySetTopics[i], 1);
      publishRelayState(i + 1);
    }
  } else {
    Serial.printf("failed (rc=%d), retrying\n", client.state());
  }
}

// ---------------------------------------------------------------------------
// WiFi
// ---------------------------------------------------------------------------
void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiAttemptAt < RECONNECT_INTERVAL_MS) return;
  lastWifiAttemptAt = now;

  Serial.println("WiFi reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void setupWifi() {
  Serial.printf("Connecting to WiFi \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi not connected yet; will keep retrying in loop()");
  }
}

// ---------------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(200);

  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    setRelay(i, false);
  }

  dht.begin();
  buildTopics();

  Serial.printf("\nRelayboard board_id=%s\n", BOARD_ID);
  Serial.printf("MAC: %s\n", WiFi.macAddress().c_str());

  setupWifi();

  // UTC time for sensor timestamps. If NTP is slow, payloads omit ts and the
  // backend uses the receive time.
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(onMessage);
  client.setKeepAlive(30);
  client.setSocketTimeout(5);
  client.setBufferSize(512);

  lastReconnectAt = millis() - RECONNECT_INTERVAL_MS;
}

void loop() {
  ensureWifi();

  if (WiFi.status() != WL_CONNECTED) {
    delay(50);
    return;
  }

  if (!client.connected()) {
    connectMqtt();
  }
  client.loop();

  if (client.connected() && millis() - lastSensorAt >= SENSOR_INTERVAL_MS) {
    lastSensorAt = millis();

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("DHT read failed; skipping this sample");
    } else {
      publishSensor("temperature", temperature);
      publishSensor("humidity", humidity);
      Serial.printf("Published temperature=%.1f humidity=%.1f\n", temperature, humidity);
    }
  }
}
