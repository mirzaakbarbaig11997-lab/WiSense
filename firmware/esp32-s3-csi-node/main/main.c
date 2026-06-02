#include <string.h>
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "lwip/sockets.h"

#define WIFI_SSID      "WiSense_Mesh"
#define WIFI_PASS      "wisense123"
#define PORT           8082
#define TARGET_IP      "192.168.1.10" // Aggregator Server IP

static const char *TAG = "WiSense_CSI_Node";
static int sock_fd = -1;
static struct sockaddr_in dest_addr;

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                             int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGI(TAG, "Disconnected from AP. Retrying...");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP:" IPSTR, IP2STR(&event->ip_info.ip));
        
        // Setup UDP Socket
        sock_fd = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
        if (sock_fd < 0) {
            ESP_LOGE(TAG, "Unable to create socket: errno %d", errno);
            return;
        }
        memset(&dest_addr, 0, sizeof(dest_addr));
        dest_addr.sin_family = AF_INET;
        dest_addr.sin_port = htons(PORT);
        dest_addr.sin_addr.s_addr = inet_addr(TARGET_IP);
        ESP_LOGI(TAG, "Socket created, streaming CSI to %s:%d", TARGET_IP, PORT);
    }
}

static void wifi_csi_cb(void *ctx, wifi_csi_info_t *info) {
    if (sock_fd < 0 || !info) return;

    // Package the CSI frame
    // We send RSSI, noise floor, subcarrier count, and the raw (In-phase, Quadrature) complex pairs
    typedef struct __attribute__((packed)) {
        uint8_t mac[6];
        int8_t rssi;
        int8_t noise_floor;
        uint16_t len;
        int8_t payload[256]; // Subcarrier I/Q values
    } csi_packet_t;

    static csi_packet_t packet;
    memcpy(packet.mac, info->rx_ctrl.sig_mode == 0 ? info->rx_ctrl.rx_state : info->rx_ctrl.rx_state, 6);
    packet.rssi = info->rx_ctrl.rssi;
    packet.noise_floor = info->rx_ctrl.noise_floor;
    packet.len = info->len;
    
    // Copy CSI data (usually 114 subcarriers for 20MHz ESP32-S3 HT20)
    int copy_len = info->len < 256 ? info->len : 256;
    memcpy(packet.payload, info->buf, copy_len);

    int err = sendto(sock_fd, &packet, sizeof(packet.mac) + 4 + copy_len, 0,
                     (struct sockaddr *)&dest_addr, sizeof(dest_addr));
    if (err < 0) {
        ESP_LOGE(TAG, "Error occurred during sending CSI: errno %d", errno);
    }
}

void app_main(void) {
    // 1. Initialize NVS (Non-volatile storage)
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 2. Initialize Network Stack
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    // 3. Connect to WiFi
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler, NULL, NULL));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    // 4. Configure CSI collection
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));
    wifi_csi_config_t csi_config = {
        .lltf_en = true,
        .htltf_en = true,
        .stbc_ltf_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = true,
        .manu_scale = false,
        .shift = false,
    };
    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&csi_config));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(&wifi_csi_cb, NULL));
    
    ESP_LOGI(TAG, "WiSense CSI Receiver Registered.");
}
