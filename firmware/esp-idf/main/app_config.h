#pragma once

#include <stddef.h>

#include "esp_err.h"

typedef struct {
    char wifi_ssid[33];
    char wifi_password[65];
    char mqtt_uri[128];
    char mqtt_username[128];
    char mqtt_password[128];
    char board_id[64];
} app_config_t;

/**
 * Initialise NVS and load the board settings.
 *
 * On first boot (empty NVS) the values from `idf.py menuconfig` are written to
 * NVS. After that NVS is the source of truth, so changing menuconfig requires
 * erasing the NVS partition (or the whole flash) and re-flashing.
 */
esp_err_t app_config_init(void);

/** Process-wide settings. Valid after app_config_init(). */
const app_config_t *app_config_get(void);
