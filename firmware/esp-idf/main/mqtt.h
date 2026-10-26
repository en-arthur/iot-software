#pragma once

#include <stdbool.h>

#include "esp_err.h"

/** Build topics, configure esp-mqtt and start the client. */
esp_err_t mqtt_init(void);

/** True while the MQTT session is established. */
bool mqtt_is_connected(void);

/** Publish {"value":...,"ts":...} on boards/{id}/sensors/{name}. */
void mqtt_publish_sensor(const char *name, float value);
