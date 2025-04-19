import {
  View,
  Text,
  ImageBackground,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import React, { useCallback, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { images } from "@/constants/images";
import InputField from "@/components/InputField";
import { icons } from "@/constants/icons";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import CustomButton from "@/components/CustomButton";
import { ReactNativeModal } from "react-native-modal";

const SignUp = () => {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setshowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const onSignInPress = useCallback(async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      setshowErrorModal(true);
    } else {
      setShowSuccessModal(true);
    }
  }, [form]);

  return (
    <SafeAreaProvider>
      <SafeAreaView>
        <ReactNativeModal isVisible={showSuccessModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Image
              source={icons.success}
              className="w-[110px] h-[110px] mx-auto my-5"
            />
            <Text className="text-3xl font-JakartaBold text-center">
              Success
            </Text>
            <Text className="text-base text-gray-400 font-Jakarta text-center">
              You have successfully Logged In
            </Text>
            <CustomButton
              title="Browse Main Page"
              onPress={() => {
                setShowSuccessModal(false);
                router.replace("/(tabs)/information");
              }}
              className="mt-5"
            />
          </View>
        </ReactNativeModal>
        <ReactNativeModal isVisible={showErrorModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Image
              source={icons.alert}
              className="w-[110px] h-[110px] mx-auto my-5"
            />
            <Text className="text-3xl font-JakartaBold text-center">Error</Text>
            <Text className="text-base text-gray-400 font-Jakarta text-center">
              {errorMessage}
            </Text>
            <CustomButton
              title="Return"
              onPress={() => {
                setErrorMessage("");
                setshowErrorModal(false);
              }}
              className="mt-5 bg-red-500"
            />
          </View>
        </ReactNativeModal>
        <ImageBackground
          source={images.sign_in_background}
          className="w-full h-full flex"
        >
          <ScrollView>
            <View className="flex-1">
              <View className="relative w-full h-[250px] flex justify-center items-center">
                <Text className="text-3xl text-black font-MontserratBold absolute top-44 flex flex-1 justify-center items-center font-bold">
                  Login
                </Text>
              </View>
              <View className="p-5 bg-white/30 backdrop-blur-none border-2 border-white border-solid h-auto w-full">
                <InputField
                  label="Email"
                  placeholder="Enter your email"
                  icon={icons.email}
                  value={form.email}
                  onChangeText={(value) => setForm({ ...form, email: value })}
                />
                <InputField
                  label="Password"
                  placeholder="Enter your password"
                  icon={icons.password}
                  value={form.password}
                  onChangeText={(value) =>
                    setForm({ ...form, password: value })
                  }
                />

                <CustomButton
                  title="Sign In"
                  onPress={onSignInPress}
                  className="mt-6"
                />

                <Link
                  href="/sign-up"
                  className="text-lg text-center text-[#575757] mt-10"
                >
                  Don't have an account?{" "}
                  <Text className="text-[#0969ff] font-JakartaSemiBold font-bold">
                    Sign Up
                  </Text>
                </Link>
              </View>
            </View>
          </ScrollView>
        </ImageBackground>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

export default SignUp;
