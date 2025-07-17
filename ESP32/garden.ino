#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <WebServer.h>

// Define OLED display parameters
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Define pins
#define DHT_PIN 4
#define SOIL_MOISTURE_PIN 34
#define RAIN_SENSOR_PIN 35
#define FLAME_SENSOR_PIN 15
#define LIGHT_SENSOR_PIN 32
#define WATER_PUMP_RELAY_PIN 26
#define SERVO_SCAN_PIN 25
#define SERVO_TILT_PIN 33
#define SPEAKER_PIN 17
#define LEFT_BUTTON_PIN 13
#define RIGHT_BUTTON_PIN 12
#define UP_BUTTON_PIN 14
#define DOWN_BUTTON_PIN 27

// Define DHT sensor type
#define DHTTYPE DHT22

// Initialize sensors
DHT dht(DHT_PIN, DHTTYPE);
Servo servoScan;
Servo servoTilt;

// Variables for sensor readings
float temperature = 0;
float humidity = 0;
int soilMoisture = 0;
int rainDetection = 0;
bool flameDetected = false;
int lightIntensity = 0;

// System state variables
bool waterPumpAutomatic = true;
bool speakerEnabled = true;
bool waterPumpActive = false;
int displayMode = 0; // 0: Welcome, 1: Temp, 2: Humidity, etc.
int scanServoPosition = 0;
int tiltServoPosition = 90;
bool scanDirectionClockwise = true;

// Variables for button debounce
unsigned long lastButtonPressTime = 0;
const long debounceDelay = 200;

// Variables for timing
unsigned long lastUpdateTime = 0;
unsigned long lastSpeakerTime = 0;
unsigned long lastServoUpdateTime = 0;
unsigned long lastFlameAlertTime = 0;
unsigned long lastSoilMoistureAlertTime = 0;

// WiFi and web server setup
const char* ssid = "<YOUR_WIFI_NAME>";
const char* password = "<YOUR_WIFI_PASSWORD>";
WebServer server(80);

// Function prototypes for handling HTTP requests
void handleGetData();
void handleServoControl();
void handleControl();

void setup() {
  // Initialize serial communication for debugging
  Serial.begin(115200);
  Serial.println("Starting Agriguardian");

  // Initialize I2C for OLED
  Wire.begin();
  
  // Initialize OLED display
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { // Address 0x3C for 128x64
    Serial.println(F("SSD1306 allocation failed"));
    for(;;); // Don't proceed, loop forever
  }
  
  // Clear the buffer and display welcome message
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(15, 20);
  display.println("Welcome!");
  display.setTextSize(1);
  display.setCursor(15, 45);
  display.println("Smart Garden System");
  display.display();
  Serial.println("OLED initialized with welcome message");

  // Initialize sensors and pins
  dht.begin();
  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(RAIN_SENSOR_PIN, INPUT);
  pinMode(FLAME_SENSOR_PIN, INPUT);
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  pinMode(WATER_PUMP_RELAY_PIN, OUTPUT);
  pinMode(SPEAKER_PIN, OUTPUT);
  pinMode(LEFT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(RIGHT_BUTTON_PIN, INPUT_PULLUP);
  pinMode(UP_BUTTON_PIN, INPUT_PULLUP);
  pinMode(DOWN_BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize outputs
  digitalWrite(WATER_PUMP_RELAY_PIN, HIGH); // Relay is active LOW
  
  // Initialize servos
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoScan.setPeriodHertz(50);  // Standard 50Hz servo
  servoTilt.setPeriodHertz(50);  // Standard 50Hz servo
  servoScan.attach(SERVO_SCAN_PIN, 500, 2400);
  servoTilt.attach(SERVO_TILT_PIN, 500, 2400);
  servoScan.write(0);
  servoTilt.write(90);
  Serial.println("Servos initialized");

  // Setup WiFi
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  // Setup server endpoints
  server.on("/data", HTTP_GET, handleGetData);
  server.on("/servo", HTTP_POST, handleServoControl);
  server.on("/control", HTTP_POST, handleControl);
  server.begin();
  Serial.println("Web server started");

  // Play startup tone
  playTone(1000, 500);
  delay(100);
  playTone(1500, 500);
  
  Serial.println("System setup complete");
}

void loop() {
  // Handle incoming client requests
  server.handleClient();
  
  // Read button states (with debouncing)
  if (millis() - lastButtonPressTime > debounceDelay) {
    // Check left button (change display mode)
    if (digitalRead(LEFT_BUTTON_PIN) == LOW) {
      displayMode = (displayMode + 1) % 8; // 8 different display modes
      updateDisplay();
      lastButtonPressTime = millis();
      Serial.print("Display mode changed to: ");
      Serial.println(displayMode);
    }
    
    // Check right button (for future use if needed)
    if (digitalRead(RIGHT_BUTTON_PIN) == LOW) {
      // Future functionality can be added here
      Serial.println("Right button pressed");
      lastButtonPressTime = millis();
    }
    
    // Check up button (enable automatic mode)
    if (digitalRead(UP_BUTTON_PIN) == LOW) {
      waterPumpAutomatic = true;
      speakerEnabled = true;
      updateDisplay();
      lastButtonPressTime = millis();
      Serial.println("Automatic mode enabled for pump and speaker");
    }
    
    // Check down button (disable automatic mode)
    if (digitalRead(DOWN_BUTTON_PIN) == LOW) {
      waterPumpAutomatic = false;
      speakerEnabled = false;
      stopWaterPump(); // Make sure pump is off when switching to manual
      updateDisplay();
      lastButtonPressTime = millis();
      Serial.println("Automatic mode disabled for pump and speaker");
    }
  }
  
  // Update sensor readings every 2 seconds
  if (millis() - lastUpdateTime > 2000) {
    readSensors();
    updateDisplay();
    checkConditions();
    lastUpdateTime = millis();
  }
  
  // Handle servo scanning motion
  if (millis() - lastServoUpdateTime > 50) {
    updateScanServo();
    lastServoUpdateTime = millis();
  }
  
  // Handle flame alerts (continuous)
  if (flameDetected && speakerEnabled && millis() - lastFlameAlertTime > 3000) {
    announceFlameAlert();
    lastFlameAlertTime = millis();
  }
}

// Function to read all sensor values
void readSensors() {
  // Read DHT22 sensor (temperature and humidity)
  float newTemp = dht.readTemperature();
  float newHumid = dht.readHumidity();
  if (!isnan(newTemp) && !isnan(newHumid)) {
    temperature = newTemp;
    humidity = newHumid;
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.print("°C, Humidity: ");
    Serial.println(humidity);
  } else {
    Serial.println("Failed to read from DHT sensor!");
  }
  
  // Read soil moisture sensor
  int rawSoilMoisture = analogRead(SOIL_MOISTURE_PIN);
  // Convert analog reading to percentage (adjust these values based on your sensor)
  // Assuming 4095 is completely dry and 1000 is fully wet
  soilMoisture = map(constrain(rawSoilMoisture, 1000, 4095), 4095, 1000, 0, 100);
  Serial.print("Soil Moisture: ");
  Serial.print(soilMoisture);
  Serial.println("%");
  
  // Read rain detection sensor
  int rawRainReading = analogRead(RAIN_SENSOR_PIN);
  // Convert analog reading to percentage (adjust these values based on your sensor)
  // Assuming 4095 is completely dry and 1000 is fully wet
  rainDetection = map(constrain(rawRainReading, 1000, 4095), 4095, 1000, 0, 100);
  Serial.print("Rain Detection: ");
  Serial.print(rainDetection);
  Serial.println("%");
  
  // Read flame sensor (digital)
  flameDetected = (digitalRead(FLAME_SENSOR_PIN) == LOW); // Most flame sensors are active LOW
  Serial.print("Flame Detected: ");
  Serial.println(flameDetected ? "YES" : "NO");
  
  // Read light sensor
  int rawLightReading = analogRead(LIGHT_SENSOR_PIN);
  // Convert analog reading to percentage (adjust these values based on your sensor)
  // Assuming 4095 is completely dark and 500 is bright light
  lightIntensity = map(constrain(rawLightReading, 500, 4095), 4095, 500, 0, 100);
  Serial.print("Light Intensity: ");
  Serial.print(lightIntensity);
  Serial.println("%");
}

// Function to check conditions and take actions
void checkConditions() {
  // Check soil moisture for auto watering
  if (waterPumpAutomatic && soilMoisture < 30 && !waterPumpActive) {
    startWaterPump();
    
    // Announce low soil moisture if speaker is enabled
    if (speakerEnabled && millis() - lastSoilMoistureAlertTime > 10000) {
      announceLowMoisture();
      lastSoilMoistureAlertTime = millis();
    }
  }
  
  // Stop water pump if soil moisture reaches 75%
  if (waterPumpActive && soilMoisture >= 75) {
    stopWaterPump();
  }
}

// Function to start water pump
void startWaterPump() {
  digitalWrite(WATER_PUMP_RELAY_PIN, LOW); // Relay is active LOW
  waterPumpActive = true;
  Serial.println("Water pump activated");
}

// Function to stop water pump
void stopWaterPump() {
  digitalWrite(WATER_PUMP_RELAY_PIN, HIGH); // Relay inactive
  waterPumpActive = false;
  Serial.println("Water pump deactivated");
}

// Function to update scan servo position
void updateScanServo() {
  if (scanDirectionClockwise) {
    scanServoPosition++;
    if (scanServoPosition >= 180) {
      scanDirectionClockwise = false;
    }
  } else {
    scanServoPosition--;
    if (scanServoPosition <= 0) {
      scanDirectionClockwise = true;
    }
  }
  servoScan.write(scanServoPosition);
}

// Function to play a tone on the speaker
void playTone(int frequency, int duration) {
  if (speakerEnabled) {
    tone(SPEAKER_PIN, frequency, duration);
    Serial.print("Playing tone: ");
    Serial.print(frequency);
    Serial.print("Hz for ");
    Serial.print(duration);
    Serial.println("ms");
  }
}

// Function to announce low soil moisture
void announceLowMoisture() {
  // Play 3 beeps for low moisture alert
  for (int i = 0; i < 3; i++) {
    playTone(800, 300);
    delay(400);
  }
  Serial.println("Low soil moisture announced");
}

// Function to announce flame alert
void announceFlameAlert() {
  // Play alarm sound for flame alert
  for (int i = 0; i < 3; i++) {
    playTone(2000, 200);
    delay(100);
    playTone(1500, 200);
    delay(100);
  }
  Serial.println("Flame alert announced");
}

// Function to update the OLED display based on current mode
void updateDisplay() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  
  switch (displayMode) {
    case 0: // Welcome screen
      display.setTextSize(2);
      display.setCursor(15, 20);
      display.println("Welcome!");
      display.setTextSize(1);
      display.setCursor(15, 45);
      display.println("Smart Garden System");
      break;
      
    case 1: // Temperature and Humidity
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Temperature & Humidity");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(10, 20);
      display.print(temperature, 1);
      display.println(" C");
      
      display.setCursor(10, 45);
      display.print(humidity, 1);
      display.println(" %");
      break;
      
    case 2: // Soil Moisture
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Soil Moisture");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(30, 25);
      display.print(soilMoisture);
      display.println(" %");
      
      display.setTextSize(1);
      display.setCursor(0, 50);
      display.print("Pump: ");
      display.println(waterPumpActive ? "ON" : "OFF");
      display.print("Auto: ");
      display.println(waterPumpAutomatic ? "ON" : "OFF");
      break;
      
    case 3: // Light Intensity
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Light Intensity");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(30, 25);
      display.print(lightIntensity);
      display.println(" %");
      break;
      
    case 4: // Rain Detection
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Rain Detection");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(30, 25);
      display.print(rainDetection);
      display.println(" %");
      break;
      
    case 5: // Flame Detection
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Flame Detection");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(20, 25);
      display.println(flameDetected ? "DETECTED!" : "Safe");
      
      if (flameDetected) {
        // Flash the display if flame detected
        if ((millis() / 500) % 2 == 0) {
          display.invertDisplay(true);
        } else {
          display.invertDisplay(false);
        }
      } else {
        display.invertDisplay(false);
      }
      break;
      
    case 6: // Water Pump Status
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Water Pump Status");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(20, 20);
      display.println(waterPumpActive ? "ACTIVE" : "OFF");
      
      display.setTextSize(1);
      display.setCursor(10, 45);
      display.print("Auto mode: ");
      display.println(waterPumpAutomatic ? "ON" : "OFF");
      break;
      
    case 7: // Speaker Status
      display.setTextSize(1);
      display.setCursor(0, 0);
      display.println("Speaker Status");
      display.drawLine(0, 10, display.width(), 10, SSD1306_WHITE);
      
      display.setTextSize(2);
      display.setCursor(30, 25);
      display.println(speakerEnabled ? "ON" : "OFF");
      break;
  }
  
  display.display();
}

// Function to handle GET requests for sensor data
void handleGetData() {
  // Create a JSON document
  DynamicJsonDocument doc(1024);
  
  // Add sensor data
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["soilMoisture"] = soilMoisture;
  doc["rainDetection"] = rainDetection;
  doc["flameDetected"] = flameDetected;
  doc["lightIntensity"] = lightIntensity;
  
  // Add system status
  doc["waterPumpActive"] = waterPumpActive;
  doc["waterPumpAutomatic"] = waterPumpAutomatic;
  doc["speakerEnabled"] = speakerEnabled;
  doc["scanServoPosition"] = scanServoPosition;
  doc["tiltServoPosition"] = tiltServoPosition;
  
  // Convert to string
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send response
  server.send(200, "application/json", jsonString);
  Serial.println("Sent sensor data as JSON");
}

// Function to handle POST requests for servo control
void handleServoControl() {
  // Check if the request has the required parameters
  if (!server.hasArg("plain")) {
    server.send(400, "text/plain", "Missing body");
    return;
  }
  
  // Parse JSON from request body
  String body = server.arg("plain");
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, body);
  
  // Check for parsing errors
  if (error) {
    server.send(400, "text/plain", "Invalid JSON");
    return;
  }
  
  // Check for servo control commands
  if (doc.containsKey("scan")) {
    int position = doc["scan"];
    if (position >= 0 && position <= 180) {
      servoScan.write(position);
      scanServoPosition = position;
      Serial.print("Set scan servo to position: ");
      Serial.println(position);
    }
  }
  
  if (doc.containsKey("tilt")) {
    int position = doc["tilt"];
    if (position >= 0 && position <= 180) {
      servoTilt.write(position);
      tiltServoPosition = position;
      Serial.print("Set tilt servo to position: ");
      Serial.println(position);
    }
  }
  
  server.send(200, "text/plain", "Servo positions updated");
}

// Function to handle POST requests for system control
void handleControl() {
  // Check if the request has the required parameters
  if (!server.hasArg("plain")) {
    server.send(400, "text/plain", "Missing body");
    return;
  }
  
  // Parse JSON from request body
  String body = server.arg("plain");
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, body);
  
  // Check for parsing errors
  if (error) {
    server.send(400, "text/plain", "Invalid JSON");
    return;
  }
  
  if (doc.containsKey("command") && doc.containsKey("state")) {
    String command = doc["command"];
    bool state = doc["state"];
    
    Serial.print("Received command: ");
    Serial.print(command);
    Serial.print(", state: ");
    Serial.println(state ? "true" : "false");
    
    if (command == "waterPump") {
      if (state) {
        startWaterPump();
      } else {
        stopWaterPump();
      }
      server.send(200, "text/plain", "Water pump state updated");
    }
    else if (command == "waterPumpAutomatic") {
      waterPumpAutomatic = state;
      if (!waterPumpAutomatic && waterPumpActive) {
        // If disabling automatic mode and pump is active, turn it off
        stopWaterPump();
      }
      server.send(200, "text/plain", "Water pump automatic mode updated");
    }
    else if (command == "speaker") {
      speakerEnabled = state;
      server.send(200, "text/plain", "Speaker state updated");
    }
    else {
      server.send(400, "text/plain", "Unknown command");
    }
  } else {
    server.send(400, "text/plain", "Missing command or state parameter");
  }
}