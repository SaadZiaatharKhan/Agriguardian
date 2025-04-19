import {
  View,
  Text,
  ImageBackground,
  ScrollView,
  Image,
} from "react-native";
import React, { useCallback, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { images } from "@/constants/images";
import InputField from "@/components/InputField";
import { icons } from "@/constants/icons";
import { Link, router } from "expo-router";
import CustomButton from "@/components/CustomButton";
import { supabase } from "@/lib/supabase";
import { ReactNativeModal } from "react-native-modal";

const SignUp = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const onSignUpPress = useCallback(async () => {
    try {
      setLoading(true);
      
      // Form validation
      if (!form.name || !form.email || !form.password) {
        setErrorMessage("Please fill in all fields");
        setShowErrorModal(true);
        setLoading(false);
        return;
      }
      
      // First, sign up the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { 
          data: { 
            name: form.name 
          }
        }
      });
      
      if (error) {
        console.error("Auth error:", error);
        setErrorMessage(error.message);
        setShowErrorModal(true);
        setLoading(false);
        return;
      }

      // If auth successful, insert into Users table
      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from("Users")
          .insert([{ 
            id: data.user.id, // Use the auth user ID as the primary key
            email: form.email, 
            name: form.name,
            // Don't store password in your Users table! It's already securely stored by Supabase Auth
            created_at: new Date()
          }]);
          
        if (userError) {
          console.error("Database error:", userError);
          setErrorMessage("Account created but profile data couldn't be saved. Please contact support.");
          setShowErrorModal(true);
        } else {
          console.log("User data saved:", userData);
          setShowSuccessModal(true);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setErrorMessage("An unexpected error occurred. Please try again later.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
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
              You have successfully Created Your Account
            </Text>
            <CustomButton
              title="Go To Login"
              onPress={() => {
                setShowSuccessModal(false);
                router.replace("/(auth)/sign-in");
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
                setShowErrorModal(false);
              }}
              className="mt-5 bg-red-500"
            />
          </View>
        </ReactNativeModal>
        <ImageBackground
          source={images.sign_up_background}
          className="w-full h-full flex"
        >
          <ScrollView>
            <View className="flex-1">
              <View className="relative w-full h-[250px] flex justify-center items-center">
                <Text className="text-3xl text-black font-MontserratBold absolute top-44 flex flex-1 justify-center items-center font-bold">
                  Create Your Account
                </Text>
              </View>
              <View className="p-5 bg-white/30 backdrop-blur-none border-2 border-white border-solid h-auto w-full">
                <InputField
                  label="Name"
                  placeholder="Enter your name"
                  icon={icons.user}
                  value={form.name}
                  onChangeText={(value) => setForm({ ...form, name: value })}
                />
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
                  secureTextEntry={true}
                  onChangeText={(value) =>
                    setForm({ ...form, password: value })
                  }
                />

                <CustomButton
                  title={loading ? "Signing Up..." : "Sign Up"}
                  onPress={onSignUpPress}
                  disabled={loading}
                  className="mt-6"
                />

                <Link
                  href="/(auth)/sign-in"
                  className="text-lg text-center text-[#575757] mt-10"
                >
                  <Text>Already have an account? </Text>
                  <Text className="text-[#0969ff] font-JakartaSemiBold font-bold ">
                    Log In
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