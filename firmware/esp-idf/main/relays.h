#pragma once

#include <stdbool.h>

#include "esp_err.h"

/** Configure the relay GPIO and drive it to the off state. */
esp_err_t relays_init(int gpio, bool active_high);

/** Switch the relay on or off. */
void relays_set(bool on);

/** Current logical state (true = on). */
bool relays_get(void);
