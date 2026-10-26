#pragma once

#include <stdbool.h>

#include "esp_err.h"

/** Initialise WiFi in station mode and start connecting. */
esp_err_t wifi_init(void);

/** True once the station has an IP address. */
bool wifi_is_connected(void);

/**
 * Reconnect if the station is down. Call from the main loop; it rate-limits
 * itself and returns immediately.
 */
void wifi_ensure_connected(void);
