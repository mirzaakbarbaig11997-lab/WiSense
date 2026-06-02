/**
 * WiSense Arduino IDE CSI Node
 * Captures CSI subcarrier metrics and streams them to the WiSense Aggregator over UDP.
 */

#include <WiFi.h>
#include <WiFiUdp.h>
#include "esp_wifi.h"

// Configuration
const char* ssid     = "WiSense_Mesh";
const char* password = "wisense123";
const char* host     = "192.168.1.10"; // Aggregator Target IP
const int port       = 8082;           // Aggregator Target Port

WiFiUDP udp;

// Packets format
typedef struct __attribute__((packed)) {
  uint8_t mac[6];
  int8_t rssi;
  int8_t noise_floor;
  uint16_t len;
  int8_t payload[256];
} csi_packet_t;

static csi_packet_t packet;

// CSI Callback function
void wifi_csi_rx_cb(void *ctx, wifi_csi_info_t *info) {
  if (!info) return;

  // Retrieve MAC address
  memcpy(packet.mac, info->rx_ctrl.rx_state, 6);
  packet.rssi = info->rx_ctrl.rssi;
  packet.noise_floor = info->rx_ctrl.noise_floor;
  packet.len = info->len;

  // Copy raw CSI buffer
  int bytes_to_copy = info->len < 256 ? info->len : 256;
  memcpy(packet.payload, info->buf, bytes_to_copy);

  // Send packet over UDP
  udp.beginPacket(host, port);
  udp.write((uint8_t*)&packet, sizeof(packet.mac) + 4 + bytes_to_copy);
  udp.endPacket();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.print("Connecting to SSID: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected.");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Init UDP
  udp.begin(port);

  // Configure CSI
  esp_err_t ret = esp_wifi_set_csi(true);
  if (ret != ESP_OK) {
    Serial.printf("esp_wifi_set_csi failed: %s\n", esp_err_to_name(ret));
    return;
  }

  wifi_csi_config_t csi_config = {
    .lltf_en = true,
    .htltf_en = true,
    .stbc_ltf_en = true,
    .ltf_merge_en = true,
    .channel_filter_en = true,
    .manu_scale = false,
    .shift = false,
  };
  
  ret = esp_wifi_set_csi_config(&csi_config);
  if (ret != ESP_OK) {
    Serial.printf("esp_wifi_set_csi_config failed: %s\n", esp_err_to_name(ret));
    return;
  }

  ret = esp_wifi_set_csi_rx_cb(&wifi_csi_rx_cb, NULL);
  if (ret != ESP_OK) {
    Serial.printf("esp_wifi_set_csi_rx_cb failed: %s\n", esp_err_to_name(ret));
    return;
  }

  Serial.println("WiSense CSI node setup complete.");
}

void loop() {
  delay(1000);
}
