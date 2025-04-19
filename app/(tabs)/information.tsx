import TopSection from "@/components/TopSection";
import { useEffect, useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/components/ThemeContext";
import { icons } from "@/constants/icons";
import { ImageSourcePropType } from "react-native";
import WebView from "react-native-webview";
import * as Location from "expo-location";

type SensorData = {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  rainDetection: number;
  flameDetected: boolean;
  lightIntensity: number;
  waterPumpActive: boolean;
  waterPumpAutomatic: boolean;
  speakerEnabled: boolean;
  scanServoPosition: number;
  tiltServoPosition: number;
};

export default function Home() {
  const [data, setData] = useState<SensorData>({
    temperature: 0,
    humidity: 0,
    soilMoisture: 0,
    rainDetection: 0,
    flameDetected: false,
    lightIntensity: 0,
    waterPumpActive: false,
    waterPumpAutomatic: false,
    speakerEnabled: false,
    scanServoPosition: 0,
    tiltServoPosition: 0,
  });

  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const ESP32_IP = "192.168.56.205";
  const ESP32_CAMERA_IP = "192.168.56.140";

  // compute heights
  const windowHeight = Dimensions.get("window").height;
  const streamHeight = windowHeight * 0.8; // 80vh for camera
  const detailsHeight = windowHeight * 0.7; // 100vh for farm details

  const fetchData = () =>
    fetch(`http://${ESP32_IP}/data`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error("Fetch error:", e));

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 3500);
    return () => clearInterval(id);
  }, []);

  const sendCommand = async (command: keyof SensorData, newState: boolean) => {
    try {
      const res = await fetch(`http://${ESP32_IP}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, state: newState }),
      });
      if (res.ok) {
        setData((d) => ({ ...d, [command]: newState }));
        setTimeout(fetchData, 500);
      } else {
        console.error(`Toggle ${command} failed`);
      }
    } catch (e) {
      console.error(`Error toggling ${command}:`, e);
    }
  };

  const renderCard = (
    icon: ImageSourcePropType,
    title: string,
    value: string | number,
    unit = "",
    action?: {
      state: boolean;
      onPress: () => void;
      labels: [string, string];
    }
  ) => (
    <View className="bg-green-500 dark:bg-gray-800 rounded-lg p-4 shadow-md m-2 w-30 h-30 items-center">
      <Image source={icon} className="w-8 h-8 mb-1" resizeMode="contain" />
      <Text className="text-gray-700 dark:text-gray-300 text-xs font-medium">
        {title}
      </Text>
      <Text className="text-gray-900 dark:text-white font-bold text-base">
        {value} {unit}
      </Text>
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          className={`px-3 py-1 rounded-full ${
            action.state ? "bg-green-500" : "bg-gray-300"
          }`}
        >
          <Text className="text-white text-xs font-medium">
            {action.state ? action.labels[0] : action.labels[1]}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  useEffect(() => {
    async function getCurrentLocation() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    }

    getCurrentLocation();
  }, []);

  let locationText = "Waiting...";
  if (errorMsg) {
    locationText = errorMsg;
  } else if (location) {
    locationText = JSON.stringify(location);
  }

  return (
    <SafeAreaView className={`flex-1 bg-${isDark ? "black" : "white"}`}>
      <ScrollView
        className="flex-1"
        nestedScrollEnabled
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <TopSection />

        {/* Live Camera Stream (80vh) */}
        <View
          style={{ height: streamHeight }}
          className="w-full bg-[#CCCDCE] p-1 rounded-lg"
        >
          <Text
            className={`px-4 py-2 text-2xl font-bold ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            <Image
              source={icons.cctv}
              className="w-6 h-6 m-2 p-1"
              resizeMode="contain"
            />
            Live Camera Stream:
          </Text>
          <View className="m-2 border border-gray-300 rounded-lg overflow-hidden flex-1">
            <WebView
              source={{ uri: `http://${ESP32_CAMERA_IP}` }}
              style={{ width: "100%", height: streamHeight }}
              javaScriptEnabled
              domStorageEnabled
              scalesPageToFit
              nestedScrollEnabled
              scrollEnabled
            />
          </View>
        </View>

        {/* Farm Details (100vh) */}
        <View
          style={{ height: detailsHeight, width: "100%" }}
          className="mt-3 rounded-lg p-1 bg-[#acefc4]"
        >
          <Text
            className={`px-4 mt-4 text-2xl font-bold ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            Farm Details:
          </Text>

          <View className="flex-row flex-wrap justify-center mt-2">
            {renderCard(
              icons.temperature,
              "Temperature",
              data.temperature,
              "°C"
            )}
            {renderCard(icons.humidity, "Humidity", data.humidity, "%")}
            {renderCard(
              icons.soil_moisture,
              "Soil Moisture",
              data.soilMoisture,
              "%"
            )}
            {renderCard(icons.rain, "Rain", data.rainDetection, "%")}
            {renderCard(
              icons.flame_detection,
              "Flame",
              data.flameDetected ? "Yes" : "No"
            )}
            {renderCard(
              icons.light_detection,
              "Light",
              data.lightIntensity,
              "%"
            )}

            {renderCard(icons.water_pump_activated, "Water Pump", "", "", {
              state: data.waterPumpActive,
              onPress: () =>
                sendCommand("waterPumpActive", !data.waterPumpActive),
              labels: ["ON", "OFF"],
            })}

            {renderCard(icons.water_pump_automated, "Auto Mode", "", "", {
              state: data.waterPumpAutomatic,
              onPress: () =>
                sendCommand("waterPumpAutomatic", !data.waterPumpAutomatic),
              labels: ["AUTO", "MANUAL"],
            })}

            {renderCard(
              data.speakerEnabled
                ? icons.speaker_enabled
                : icons.speaker_disabled,
              "Speaker",
              "",
              "",
              {
                state: data.speakerEnabled,
                onPress: () =>
                  sendCommand("speakerEnabled", !data.speakerEnabled),
                labels: ["ON", "OFF"],
              }
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
