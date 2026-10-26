#include <stdbool.h>

#include "app_config.h"
#include "dht11.h"
#include "esp_log.h"
#include "esp_sntp.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mqtt.h"
#include "relays.h"
#include "sdkconfig.h"
#include "wifi.h"

static const char *TAG = "main";

#ifdef CONFIG_RELAYBOARD_RELAY_ACTIVE_HIGH
#define RELAY_ACTIVE_HIGH true
#else
#define RELAY_ACTIVE_HIGH false
#endif

static void start_sntp(void)
{
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_init();
}

void app_main(void)
{
    ESP_LOGI(TAG, "relayboard starting");

    ESP_ERROR_CHECK(app_config_init());

    const app_config_t *cfg = app_config_get();
    ESP_LOGI(TAG, "board_id=%s broker=%s", cfg->board_id, cfg->mqtt_uri);

    ESP_ERROR_CHECK(relays_init(CONFIG_RELAYBOARD_RELAY_GPIO, RELAY_ACTIVE_HIGH));
    ESP_ERROR_CHECK(dht11_init(CONFIG_RELAYBOARD_DHT_GPIO));
    ESP_ERROR_CHECK(wifi_init());
    ESP_ERROR_CHECK(mqtt_init());

    start_sntp();

    const int64_t interval_us = (int64_t)CONFIG_RELAYBOARD_SENSOR_INTERVAL_S * 1000 * 1000;
    int64_t last_sample_us = esp_timer_get_time() - interval_us;

    while (true) {
        wifi_ensure_connected();

        int64_t now = esp_timer_get_time();
        if (wifi_is_connected() && mqtt_is_connected() && now - last_sample_us >= interval_us) {
            last_sample_us = now;

            float temperature = 0.0f;
            float humidity = 0.0f;
            esp_err_t err = dht11_read(&temperature, &humidity);
            if (err == ESP_OK) {
                mqtt_publish_sensor("temperature", temperature);
                mqtt_publish_sensor("humidity", humidity);
                ESP_LOGI(TAG, "temperature=%.1f humidity=%.1f", temperature, humidity);
            } else {
                ESP_LOGW(TAG, "DHT11 read failed: %s", esp_err_to_name(err));
            }
        }

        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
