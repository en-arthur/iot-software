#include "app_config.h"

#include <stdbool.h>
#include <string.h>

#include "esp_check.h"
#include "esp_log.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"

static const char *TAG = "app_config";
static const char *NVS_NAMESPACE = "relayboard";

static app_config_t s_config;

static void copy_value(char *dst, size_t dst_size, const char *src)
{
    if (dst_size == 0) {
        return;
    }
    strncpy(dst, src, dst_size - 1);
    dst[dst_size - 1] = '\0';
}

/**
 * Read a string from NVS, falling back to the menuconfig value on first boot.
 * Returns true through `seeded` when the fallback had to be written.
 */
static esp_err_t load_or_seed(nvs_handle_t handle,
                              const char *key,
                              char *dst,
                              size_t dst_size,
                              const char *fallback,
                              bool *seeded)
{
    size_t length = dst_size;
    esp_err_t err = nvs_get_str(handle, key, dst, &length);
    if (err == ESP_OK) {
        return ESP_OK;
    }
    if (err != ESP_ERR_NVS_NOT_FOUND) {
        return err;
    }

    copy_value(dst, dst_size, fallback);
    ESP_RETURN_ON_ERROR(nvs_set_str(handle, key, dst), TAG, "could not seed %s", key);
    *seeded = true;
    return ESP_OK;
}

esp_err_t app_config_init(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "erasing incompatible NVS partition");
        ESP_RETURN_ON_ERROR(nvs_flash_erase(), TAG, "nvs erase failed");
        err = nvs_flash_init();
    }
    ESP_RETURN_ON_ERROR(err, TAG, "nvs init failed");

    nvs_handle_t handle;
    ESP_RETURN_ON_ERROR(nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle), TAG, "nvs open failed");

    bool seeded = false;

    ESP_RETURN_ON_ERROR(
        load_or_seed(handle, "wifi_ssid", s_config.wifi_ssid, sizeof(s_config.wifi_ssid),
                     CONFIG_RELAYBOARD_WIFI_SSID, &seeded),
        TAG, "wifi_ssid");
    ESP_RETURN_ON_ERROR(
        load_or_seed(handle, "wifi_pass", s_config.wifi_password, sizeof(s_config.wifi_password),
                     CONFIG_RELAYBOARD_WIFI_PASSWORD, &seeded),
        TAG, "wifi_pass");
    ESP_RETURN_ON_ERROR(
        load_or_seed(handle, "mqtt_uri", s_config.mqtt_uri, sizeof(s_config.mqtt_uri),
                     CONFIG_RELAYBOARD_MQTT_URI, &seeded),
        TAG, "mqtt_uri");
    ESP_RETURN_ON_ERROR(
        load_or_seed(handle, "mqtt_user", s_config.mqtt_username, sizeof(s_config.mqtt_username),
                     CONFIG_RELAYBOARD_MQTT_USERNAME, &seeded),
        TAG, "mqtt_user");
    ESP_RETURN_ON_ERROR(
        load_or_seed(handle, "mqtt_pass", s_config.mqtt_password, sizeof(s_config.mqtt_password),
                     CONFIG_RELAYBOARD_MQTT_PASSWORD, &seeded),
        TAG, "mqtt_pass");
    ESP_RETURN_ON_ERROR(
        load_or_seed(handle, "board_id", s_config.board_id, sizeof(s_config.board_id),
                     CONFIG_RELAYBOARD_BOARD_ID, &seeded),
        TAG, "board_id");

    if (seeded) {
        ESP_RETURN_ON_ERROR(nvs_commit(handle), TAG, "nvs commit failed");
        ESP_LOGI(TAG, "seeded NVS from menuconfig defaults");
        ESP_LOGI(TAG, "to change settings later: idf.py erase-flash && idf.py flash monitor");
    }

    nvs_close(handle);

    ESP_LOGI(TAG, "board_id=%s broker=%s", s_config.board_id, s_config.mqtt_uri);
    return ESP_OK;
}

const app_config_t *app_config_get(void)
{
    return &s_config;
}
