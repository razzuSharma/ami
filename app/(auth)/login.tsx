// app/login.tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err: any) {
      Alert.alert("Login Error", err.message);
    }
  };

  return (
    <View className="flex-1 bg-slate-950 px-6 justify-center">
      {/* Subtle background accents */}
      <View className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
      <View className="absolute bottom-0 -left-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />

      {/* Header */}
      <View className="mb-10">
        <Text className="text-white text-3xl font-semibold mb-2">
          Sign in
        </Text>
        <Text className="text-slate-400 text-base">
          Welcome back, please login to continue
        </Text>
      </View>

      {/* Form */}
      <View className="space-y-5">
        {/* Email */}
        <View className="flex flex-col gap-5">
        <View>
          <Text className="text-slate-300 text-sm mb-1">
            Email
          </Text>
          <View className="h-12 rounded-lg bg-slate-900 border border-slate-800 px-3 justify-center">
            <TextInput
              className="text-white text-base"
              placeholder="name@example.com"
              placeholderTextColor="#64748B"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
        </View>

        {/* Password */}
        <View>
          <Text className="text-slate-300 text-sm mb-1">
            Password
          </Text>
          <View className="h-12 rounded-lg bg-slate-900 border border-slate-800 px-3 justify-center">
            <TextInput
              className="text-white text-base"
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>
        </View>

        {/* Button */}
        <TouchableOpacity
          className="h-12 rounded-lg bg-blue-600 items-center justify-center mt-2"
          activeOpacity={0.9}
          onPress={handleLogin}
        >
          <Text className="text-white text-base font-semibold">
            Sign in
          </Text>
        </TouchableOpacity>

        {/* Signup */}
        <TouchableOpacity
          className="mt-6"
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text className="text-slate-400 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Text className="text-blue-400 font-medium">
              Sign up
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
