// components/TopSection.tsx
import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { UserContext } from './UserContext';
import { useTheme } from '@/components/ThemeContext';
import ToggleAppearance from './ToggleAppearance';
import Notification from './Notification';
import Profile from './Profile';

const TopSection = () => {
  const { user } = useContext(UserContext);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View
      className={`flex-row justify-between items-center w-full p-3 m-3 ${
        isDark ? 'bg-black' : 'bg-white'
      }`}
    >
      <Text
        className={`text-xl font-bold font-JakartaBold ${
          isDark ? 'text-white' : 'text-black'
        }`}
      >
        Hello, {user?.name}
      </Text>
      <View className="flex-row items-center">
        <ToggleAppearance />
        <Notification />
        <Profile />
      </View>
    </View>
  );
};

export default TopSection;
