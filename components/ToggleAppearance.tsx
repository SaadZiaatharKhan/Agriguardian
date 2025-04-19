// components/TopSection/ToggleAppearance.tsx
import React from "react";
import { View, Pressable, Image } from "react-native";
import { icons } from "@/constants/icons";
import { useTheme } from "@/components/ThemeContext";

const ToggleAppearance = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <View className="">
      <View
        className={
          isDark
            ? "items-center p-2 rounded-full bg-[#000]"
            : "items-center p-2 rounded-full bg-white"
        }
      >
        <Pressable
          onPress={toggleTheme}
          className={
            isDark ? "p-2 bg-[#000] rounded-full" : "p-2 bg-[#eee] rounded-full"
          }
        >
          <Image
            source={isDark ? icons.dark_mode : icons.light_mode}
            className="w-6 h-6"
            resizeMode="contain"
          />
        </Pressable>
      </View>
    </View>
  );
};

export default ToggleAppearance;
