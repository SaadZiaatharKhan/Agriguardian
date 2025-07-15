// components/TopSection.tsx
import React, { useContext, useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import * as Location from "expo-location";
import moment from "moment";

import { UserContext } from "./UserContext";
import { useTheme } from "@/components/ThemeContext";
import ToggleAppearance from "./ToggleAppearance";
import Notification from "./Notification";
import Profile from "./Profile";
import { icons } from "@/constants/icons";

const TopSection: React.FC = () => {
  const { user } = useContext(UserContext);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(
    moment().format("DD/MM/YYYY")
  );
  const [currentTime, setCurrentTime] = useState<string>(
    moment().format("hh:mm:ss A")
  );

  useEffect(() => {
    // Update date/time every second
    const timer = setInterval(() => {
      setCurrentDate(moment().format("DD/MM/YYYY"));
      setCurrentTime(moment().format("hh:mm:ss A"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // 1. Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          return;
        }

        // 2. Get current position
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);

        // 3. Native reverse geocoding
        const [geoAddr] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        // 4. Build a display string
        const components = [
          geoAddr.name,
          geoAddr.street,
          geoAddr.city,
          geoAddr.region,
          geoAddr.country,
        ].filter(Boolean);
        setAddress(components.join(", "));
      } catch (e: any) {
        setErrorMsg(`Location error: ${e.message}`);
      }
    })();
  }, []);

  // Determine which text to show for address
  let addressText: string;
  if (errorMsg) {
    addressText = errorMsg;
  } else if (address) {
    addressText = address;
  } else if (location) {
    addressText = "Fetching address…";
  } else {
    addressText = "Waiting for location…";
  }

  return (
    <View
      className={`flex-row justify-between items-center w-full p-5 pt-0 m-3 ${
        isDark ? "bg-black" : "bg-white"
      }`}
    >
      <View>
        <Text
          className={`text-xl font-bold font-JakartaBold ${
            isDark ? "text-white" : "text-black"
          }`}
        >
          Hello, {user?.name}
        </Text>

        <View className="flex-row items-center mt-1">
          <Image
            source={icons.location}
            className="w-4 h-4 mr-1"
            resizeMode="contain"
          />
          <Text
            className={`text-[6px] font-semibold ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            {addressText}
          </Text>
        </View>

        <View className="flex-row items-center mt-1">
          <Image
            source={icons.date}
            className="w-4 h-4 mr-1"
            resizeMode="contain"
          />
          <Text
            className={`text-[6px] font-semibold ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            {currentDate}
          </Text>
        </View>

        <View className="flex-row items-center mt-1">
          <Image
            source={icons.time}
            className="w-4 h-4 mr-1"
            resizeMode="contain"
          />
          <Text
            className={`text-[6px] font-semibold ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            {currentTime}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center space-x-3">
        <ToggleAppearance />
        <Notification />
        <Profile />
      </View>
    </View>
  );
};

export default TopSection;
