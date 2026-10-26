#include "dht11.h"

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "driver/gpio.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_rom_sys.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "dht11";

static int s_gpio = -1;
static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;

static bool wait_level(int level, int timeout_us)
{
    int64_t start = esp_timer_get_time();
    while (gpio_get_level(s_gpio) != level) {
        if (esp_timer_get_time() - start > timeout_us) {
            return false;
        }
    }
    return true;
}

esp_err_t dht11_init(int gpio)
{
    s_gpio = gpio;

    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << gpio,
        .mode = GPIO_MODE_INPUT_OUTPUT_OD,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    ESP_RETURN_ON_ERROR(gpio_config(&cfg), TAG, "gpio %d config failed", gpio);

    // Open drain + pull-up: level 1 releases the line, level 0 drives it low.
    gpio_set_level(gpio, 1);
    ESP_LOGI(TAG, "DHT11 on GPIO %d", gpio);
    return ESP_OK;
}

esp_err_t dht11_read(float *temperature_c, float *humidity_pct)
{
    if (s_gpio < 0 || temperature_c == NULL || humidity_pct == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    uint8_t data[5] = {0};
    bool ok = true;

    // Start signal: hold the line low for at least 18 ms. Keep interrupts
    // enabled here; only the timing-critical response is read in a critical
    // section.
    gpio_set_level(s_gpio, 0);
    vTaskDelay(pdMS_TO_TICKS(20));
    gpio_set_level(s_gpio, 1);
    esp_rom_delay_us(40);

    portENTER_CRITICAL(&s_mux);

    // Sensor response: 80 us low, then 80 us high.
    ok = wait_level(0, 200) && wait_level(1, 200) && wait_level(0, 200);

    // 40 data bits: 50 us low, then 26-28 us high (0) or ~70 us high (1).
    for (int i = 0; ok && i < 40; i++) {
        if (!wait_level(1, 200)) {
            ok = false;
            break;
        }

        int64_t high_start = esp_timer_get_time();
        if (!wait_level(0, 200)) {
            ok = false;
            break;
        }
        int64_t high_us = esp_timer_get_time() - high_start;

        data[i / 8] <<= 1;
        if (high_us > 40) {
            data[i / 8] |= 1;
        }
    }

    portEXIT_CRITICAL(&s_mux);

    if (!ok) {
        ESP_LOGW(TAG, "no response from sensor");
        return ESP_ERR_TIMEOUT;
    }

    uint8_t checksum = (uint8_t)(data[0] + data[1] + data[2] + data[3]);
    if (checksum != data[4]) {
        ESP_LOGW(TAG, "checksum mismatch");
        return ESP_ERR_INVALID_CRC;
    }

    *humidity_pct = data[0] + data[1] * 0.1f;
    *temperature_c = data[2] + (data[3] & 0x7F) * 0.1f;
    if (data[3] & 0x80) {
        *temperature_c = -*temperature_c;
    }
    return ESP_OK;
}
