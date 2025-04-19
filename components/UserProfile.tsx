import { View, Text, Image, TouchableOpacity } from 'react-native';
import React, { useContext, useState } from 'react';
import ReactNativeModal from 'react-native-modal';
import { router } from 'expo-router';
import CustomButton from './CustomButton';
import { icons } from '@/constants/icons';
import { UserContext } from './UserContext';
import { supabase } from '@/lib/supabase';

// Define the props type
interface UserProfileProps {
  showModal: boolean; // Specify the type of showModal
}

const UserProfile: React.FC<UserProfileProps> = ({ showModal }) => {
  const { user } = useContext(UserContext);
  const [show, setShow] = useState(showModal);
  

  return (
    <ReactNativeModal isVisible={show} onBackdropPress={() => setShow(false)}>
      <View className="bg-[#e0d856] px-7 py-9 rounded-2xl min-h-[300px]">
        <Image
          source={icons.user_modal}
          className="w-[110px] h-[110px] mx-auto my-5"
        />
        <Text className="text-2xl font-JakartaBold text-center font-semibold">
          Name:
        </Text>
        <Text className="text-xl font-JakartaBold text-center font-medium">
          {user?.name}
        </Text>
        <Text className="text-2xl font-JakartaBold text-center font-semibold">
          Email:
        </Text>
        <Text className="text-xl font-JakartaBold text-center font-medium">
          {user?.email}
        </Text>
        <CustomButton
          title="Log Out"
          onPress={async () => {
            const { error } = await supabase.auth.signOut()
            if (!error) {
              setShow(false);
            router.replace("/(auth)/sign-in");
            }
          }}
          className="mt-5 bg-red-500"
        />
      </View>
    </ReactNativeModal>
  );
};

export default UserProfile;