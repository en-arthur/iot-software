#pragma once

#include "esp_err.h"

/** Configure the DHT11 data GPIO. */
esp_err_t dht11_init(int gpio);

/**
 * Read temperature (Celsius) and relative humidity (percent).
 *
 * Returns ESP_ERR_TIMEOUT when the sensor does not respond and
 * ESP_ERR_INVALID_CRC when the checksum fails. Do not call more often than
 * once every 2 seconds.
 */
esp_err_t dht11_read(float *temperature_c, float *humidity_pct);
