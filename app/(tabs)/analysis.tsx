import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from "react-native";
import React, { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import PlantMonitorApp from "@/components/PlantMonitor";
import Recommendations from "@/components/Recommendations";
import SearchData from "@/components/SearchData";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Analysis = () => {
  const [activeTab, setActiveTab] = useState("Analysis");

  // Animate on tab change
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [activeTab]);

  const tabs = ["Analysis", "Advice", "Search Data"];

  return (
    <SafeAreaView className="flex-1 items-center">
      <View className="flex flex-row m-1 p-1 bg-[#3cc4fe] rounded-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab)}
              className={`m-1 p-2 rounded-full ${
                isActive ? "bg-[#99e2ff]" : "bg-[#3cc4fe]"
              }`}
            >
              <Text
                className={`${
                  isActive ? "text-gray-500 font-bold" : "text-white font-semibold"
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Render content based on activeTab */}
      <View className="mt-4">
        {activeTab === "Analysis" && <PlantMonitorApp />}
        {activeTab === "Advice" && <Recommendations />}
        {activeTab === "Search Data" && <SearchData />}
      </View>
    </SafeAreaView>
  );
};

export default Analysis;
