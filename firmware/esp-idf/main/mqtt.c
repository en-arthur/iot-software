#include "mqtt.h"

#include <stdatomic.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#include "app_config.h"
#include "esp_check.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include "relays.h"

static const char *TAG = "mqtt";

static esp_mqtt_client_handle_t s_client = NULL;
static atomic_bool s_connected = false;

static char s_topic_status[128];
static char s_topic_relay_set[128];
static char s_topic_relay_state[128];

static void publish_status(const char *status)
{
    if (s_client == NULL) {
        return;
    }
    // Retained so the backend and late subscribers see the current state.
    esp_mqtt_client_publish(s_client, s_topic_status, status, 0, 1, 1);
}

static void publish_relay_state(void)
{
    if (s_client == NULL) {
        return;
    }
    esp_mqtt_client_publish(s_client, s_topic_relay_state, relays_get() ? "on" : "off", 0, 1, 0);
}

static void handle_relay_command(const char *payload, int length)
{
    if (payload == NULL || length <= 0) {
        return;
    }

    char command[16] = {0};
    int copy = length < (int)sizeof(command) - 1 ? length : (int)sizeof(command) - 1;
    memcpy(command, payload, copy);

    char *start = command;
    while (*start == ' ' || *start == '\t' || *start == '\r' || *start == '\n') {
        start++;
    }

    char *end = start + strlen(start);
    while (end > start &&
           (end[-1] == ' ' || end[-1] == '\t' || end[-1] == '\r' || end[-1] == '\n')) {
        *--end = '\0';
    }

    for (char *p = start; *p != '\0'; p++) {
        if (*p >= 'A' && *p <= 'Z') {
            *p = (char)(*p - 'A' + 'a');
        }
    }

    if (strcmp(start, "on") == 0) {
        relays_set(true);
    } else if (strcmp(start, "off") == 0) {
        relays_set(false);
    } else {
        ESP_LOGW(TAG, "ignoring relay command \"%s\"", start);
        return;
    }

    publish_relay_state();
}

static void mqtt_event_handler(void *args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    (void)args;
    (void)base;

    esp_mqtt_event_handle_t event = event_data;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        atomic_store(&s_connected, true);
        ESP_LOGI(TAG, "connected to broker");
        // Subscribe before announcing "online" so a command cannot arrive
        // before the board is listening.
        esp_mqtt_client_subscribe(s_client, s_topic_relay_set, 1);
        publish_status("online");
        publish_relay_state();
        break;

    case MQTT_EVENT_DISCONNECTED:
        atomic_store(&s_connected, false);
        ESP_LOGW(TAG, "disconnected from broker");
        break;

    case MQTT_EVENT_DATA:
        if (event->topic_len == (int)strlen(s_topic_relay_set) &&
            strncmp(event->topic, s_topic_relay_set, event->topic_len) == 0) {
            handle_relay_command(event->data, event->data_len);
        } else {
            ESP_LOGD(TAG, "ignoring message on %.*s", event->topic_len, event->topic);
        }
        break;

    case MQTT_EVENT_ERROR:
        ESP_LOGW(TAG, "transport error");
        break;

    default:
        break;
    }
}

static esp_err_t build_topics(void)
{
    const app_config_t *cfg = app_config_get();

    int status_len =
        snprintf(s_topic_status, sizeof(s_topic_status), "boards/%s/status", cfg->board_id);
    int set_len = snprintf(s_topic_relay_set, sizeof(s_topic_relay_set),
                           "boards/%s/relays/1/set", cfg->board_id);
    int state_len = snprintf(s_topic_relay_state, sizeof(s_topic_relay_state),
                             "boards/%s/relays/1/state", cfg->board_id);

    if (status_len < 0 || status_len >= (int)sizeof(s_topic_status) || set_len < 0 ||
        set_len >= (int)sizeof(s_topic_relay_set) || state_len < 0 ||
        state_len >= (int)sizeof(s_topic_relay_state)) {
        ESP_LOGE(TAG, "board id too long for topic buffers");
        return ESP_ERR_INVALID_SIZE;
    }
    return ESP_OK;
}

esp_err_t mqtt_init(void)
{
    const app_config_t *cfg = app_config_get();

    ESP_RETURN_ON_ERROR(build_topics(), TAG, "topic setup failed");

    static char client_id[96];
    snprintf(client_id, sizeof(client_id), "relayboard-%s", cfg->board_id);

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = cfg->mqtt_uri,
        .credentials.username = cfg->mqtt_username,
        .credentials.authentication.password = cfg->mqtt_password,
        .credentials.client_id = client_id,
        .session.keepalive = 30,
        .session.last_will.topic = s_topic_status,
        .session.last_will.msg = "offline",
        .session.last_will.msg_len = 7,
        .session.last_will.qos = 1,
        .session.last_will.retain = true,
        .network.reconnect_timeout_ms = 5000,
    };

    s_client = esp_mqtt_client_init(&mqtt_cfg);
    if (s_client == NULL) {
        ESP_LOGE(TAG, "esp_mqtt_client_init failed");
        return ESP_FAIL;
    }

    ESP_RETURN_ON_ERROR(
        esp_mqtt_client_register_event(s_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL), TAG,
        "event registration failed");
    ESP_RETURN_ON_ERROR(esp_mqtt_client_start(s_client), TAG, "client start failed");

    ESP_LOGI(TAG, "connecting to %s as %s", cfg->mqtt_uri, client_id);
    return ESP_OK;
}

bool mqtt_is_connected(void)
{
    return atomic_load(&s_connected);
}

void mqtt_publish_sensor(const char *name, float value)
{
    if (s_client == NULL || !atomic_load(&s_connected) || name == NULL) {
        return;
    }

    const app_config_t *cfg = app_config_get();
    char topic[160];
    char payload[80];

    int topic_len = snprintf(topic, sizeof(topic), "boards/%s/sensors/%s", cfg->board_id, name);
    if (topic_len < 0 || topic_len >= (int)sizeof(topic)) {
        ESP_LOGW(TAG, "sensor topic too long");
        return;
    }

    time_t now = time(NULL);
    if (now > 1700000000) {
        snprintf(payload, sizeof(payload), "{\"value\":%.1f,\"ts\":%lld}", value, (long long)now);
    } else {
        // Clock not synced yet; the backend falls back to receive time.
        snprintf(payload, sizeof(payload), "{\"value\":%.1f}", value);
    }

    esp_mqtt_client_publish(s_client, topic, payload, 0, 0, 0);
}
