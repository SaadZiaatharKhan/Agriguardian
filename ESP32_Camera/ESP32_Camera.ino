#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>

// Pull in the example HTML/images for the camera UI (only once!)
#include <camera_index.h>

// Forward‑declare the server routine you have in app_httpd.cpp
extern void startCameraServer();

// Choose your board
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// Wi‑Fi credentials
const char* ssid     = "<YOUR_WIFI_NAME>";
const char* password = "<YOUR_WIFI_PASSWORD>";

// Python server snapshot endpoint
const char* apiEndpoint     = "http://<YOUR_IPv4_ADDRESS>:8000/snapshot";

// Capture interval (ms)
const unsigned long CAPTURE_INTERVAL = 10000;
unsigned long previousCaptureTime = 0;

// Web server running on port 80
WebServer server(80);

// ----------------------------------------------------------------------------
// MJPEG stream handler

void handleJPGStream() {
  WiFiClient client = server.client();
  server.sendContent("HTTP/1.1 200 OK\r\n"
                     "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n\r\n");

  while (client.connected()) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("▶ Stream capture failed");
      break;
    }
    client.printf("--frame\r\n"
                  "Content-Type: image/jpeg\r\n"
                  "Content-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    esp_camera_fb_return(fb);
    delay(100);
  }
}

// ----------------------------------------------------------------------------
// Periodic snapshot & POST to Python

void captureAndSendSnapshot() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("▶ Capture failed");
    return;
  }

  HTTPClient http;
  http.begin(apiEndpoint);
  http.addHeader("Content-Type", "image/jpeg");

  // send the fb buffer directly as the POST payload
  int code = http.sendRequest("POST", (uint8_t*)fb->buf, fb->len);
  if (code > 0) {
    String resp = http.getString();
    Serial.printf("▶ POST %d, Resp: %s\n", code, resp.c_str());
  } else {
    Serial.printf("▶ POST failed: %d\n", code);
  }

  http.end();
  esp_camera_fb_return(fb);
}


// ----------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nInitializing camera...");

  // Camera config
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_SVGA;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 10;
  config.fb_count     = 2;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("Camera init failed");
    while (true) { delay(1000); }
  }

  // Connect Wi‑Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("WiFi connected: %s\n", WiFi.localIP().toString().c_str());

  // Start the stream server (from app_httpd.cpp)
  startCameraServer();

  // Take and send first snapshot immediately
  captureAndSendSnapshot();
  previousCaptureTime = millis();
}

void loop() {
  server.handleClient();

  if (millis() - previousCaptureTime >= CAPTURE_INTERVAL) {
    previousCaptureTime = millis();
    captureAndSendSnapshot();
  }
}
