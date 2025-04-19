import { View, Text, Image, ImageSourcePropType } from "react-native";
import React from "react";
import { Tabs } from "expo-router";
import { UserProvider } from "@/components/UserContext";
import { icons } from "@/constants/icons";
import { ThemeProvider } from "@/components/ThemeContext";

const TabIcon = ({
  source,
  focused,
  title,
}: {
  source: ImageSourcePropType;
  focused: boolean;
  title: string;
}) => (
  <View className="items-center justify-center py-1">
    <View
      className={`rounded-full flex w-12 h-12 items-center justify-center ${
        focused ? "bg-gray-800" : ""
      }`}
    >
      <Image
        source={source}
        resizeMode="contain"
        className="w-7 h-7"
      />
    </View>
    {focused && (
      <Text className="text-black text-[8px] w-12 h-12 mt-1 font-medium text-center">
        {title}
      </Text>
    )}
  </View>
);

const _Layout = () => {
  return (
    <UserProvider>
      <ThemeProvider>
      <Tabs
        initialRouteName="information"
        screenOptions={{
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: "#a8f2c2",
            borderRadius: 50,
            paddingVertical: 5,
            marginHorizontal: 20,
            marginBottom: 25,
            height: 80,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: 4,
            },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            zIndex: 1000,
          },
        }}
      >
        <Tabs.Screen
          name="information"
          options={{
            title: "Information",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon 
                source={icons.information} 
                focused={focused} 
                title="Info" 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="analysis"
          options={{
            title: "Analysis",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon 
                source={icons.analysis} 
                focused={focused} 
                title="Analysis" 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="forum"
          options={{
            title: "Forum",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon 
                source={icons.chat} 
                focused={focused} 
                title="Forum" 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="nearest_shops"
          options={{
            title: "Nearest Shops",
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon 
                source={icons.shop} 
                focused={focused} 
                title="Shops" 
              />
            ),
          }}
        />
      </Tabs>
      </ThemeProvider>
    </UserProvider>
  );
};

export default _Layout;