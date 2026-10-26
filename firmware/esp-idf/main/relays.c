#include "relays.h"

#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_log.h"

static const char *TAG = "relays";

static int s_gpio = -1;
static bool s_active_high = true;
static bool s_on = false;

esp_err_t relays_init(int gpio, bool active_high)
{
    s_gpio = gpio;
    s_active_high = active_high;

    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << gpio,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&cfg), TAG, "gpio %d config failed", gpio);

    relays_set(false);
    ESP_LOGI(TAG, "relay on GPIO %d (%s)", gpio, active_high ? "active high" : "active low");
    return ESP_OK;
}

void relays_set(bool on)
{
    if (s_gpio < 0) {
        return;
    }

    s_on = on;
    int level = (on == s_active_high) ? 1 : 0;
    gpio_set_level(s_gpio, level);
    ESP_LOGI(TAG, "relay -> %s", on ? "on" : "off");
}

bool relays_get(void)
{
    return s_on;
}
