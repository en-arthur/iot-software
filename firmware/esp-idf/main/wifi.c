#include "wifi.h"

#include <stdatomic.h>
#include <string.h>

#include "app_config.h"
#include "esp_check.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"

static const char *TAG = "wifi";

#define RETRY_INTERVAL_US (5 * 1000 * 1000)

static atomic_bool s_connected = false;
static int64_t s_last_attempt_us = 0;

static void wifi_event_handler(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg;

    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        atomic_store(&s_connected, false);
        ESP_LOGW(TAG, "disconnected from AP, will retry");
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        const ip_event_got_ip_t *event = data;
        atomic_store(&s_connected, true);
        ESP_LOGI(TAG, "connected, ip=" IPSTR, IP2STR(&event->ip_info.ip));
    }
}

static void copy_wifi_field(uint8_t *dst, size_t dst_size, const char *src)
{
    size_t len = strlen(src);
    if (len > dst_size) {
        len = dst_size;
    }
    memcpy(dst, src, len);
}

esp_err_t wifi_init(void)
{
    const app_config_t *cfg = app_config_get();

    ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "netif init failed");

    esp_err_t err = esp_event_loop_create_default();
    if (err != ESP_OK && err != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "event loop init failed: %s", esp_err_to_name(err));
        return err;
    }

    esp_netif_t *sta_netif = esp_netif_create_default_wifi_sta();
    if (sta_netif == NULL) {
        ESP_LOGE(TAG, "could not create default station netif");
        return ESP_FAIL;
    }

    wifi_init_config_t init_cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&init_cfg), TAG, "wifi init failed");

    ESP_RETURN_ON_ERROR(
        esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL),
        TAG, "wifi event handler failed");
    ESP_RETURN_ON_ERROR(
        esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL),
        TAG, "ip event handler failed");

    wifi_config_t wifi_cfg = {0};
    copy_wifi_field(wifi_cfg.sta.ssid, sizeof(wifi_cfg.sta.ssid), cfg->wifi_ssid);
    copy_wifi_field(wifi_cfg.sta.password, sizeof(wifi_cfg.sta.password), cfg->wifi_password);
    wifi_cfg.sta.threshold.authmode = WIFI_AUTH_WPA_WPA2_PSK;

    ESP_RETURN_ON_ERROR(esp_wifi_set_storage(WIFI_STORAGE_RAM), TAG, "storage mode failed");
    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), TAG, "station mode failed");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg), TAG, "wifi config failed");
    ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "wifi start failed");

    // WIFI_EVENT_STA_START triggers the first esp_wifi_connect().
    s_last_attempt_us = esp_timer_get_time();
    ESP_LOGI(TAG, "connecting to \"%s\"", cfg->wifi_ssid);
    return ESP_OK;
}

bool wifi_is_connected(void)
{
    return atomic_load(&s_connected);
}

void wifi_ensure_connected(void)
{
    if (atomic_load(&s_connected)) {
        return;
    }

    int64_t now = esp_timer_get_time();
    if (now - s_last_attempt_us < RETRY_INTERVAL_US) {
        return;
    }
    s_last_attempt_us = now;

    ESP_LOGI(TAG, "reconnecting to \"%s\"", app_config_get()->wifi_ssid);
    esp_err_t err = esp_wifi_connect();
    if (err != ESP_OK && err != ESP_ERR_WIFI_CONN) {
        ESP_LOGW(TAG, "esp_wifi_connect: %s", esp_err_to_name(err));
    }
}
