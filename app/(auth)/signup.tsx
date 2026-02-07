import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAuth } from "../../contexts/AuthContext";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.9);
  const shimmerAnim = useSharedValue(-200);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerAnim.value }],
  }));

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 100 });
    
    shimmerAnim.value = withRepeat(
      withTiming(400, { duration: 2500 }),
      -1,
      false
    );
  }, []);

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      Alert.alert(
        "Success",
        "Account created! Please check your email to verify your account.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    } catch (err: any) {
      Alert.alert("Signup Error", err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0f172a", "#1e293b", "#0f172a"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={containerStyle} className="flex-1 justify-center">
            {/* Header with Logo */}
            <View className="items-center mb-10">
              <View className="relative mb-6">
                {/* Glow effect */}
                <View className="absolute -inset-4 opacity-30">
                  <LinearGradient
                    colors={["#3b82f6", "#8b5cf6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="w-full h-full rounded-full blur-3xl"
                  />
                </View>
                
                <View className="relative">
                  {/* <LinearGradient
                    colors={["#3b82f6", "#8b5cf6"]}
                    className="rounded-full p-1"
                  > */}
                    <View className="bg-slate-900 rounded-full p-1">
                      <Image
                        source={require("../../assets/images/image-ami.png")}
                        className="w-24 h-24 rounded-full"
                        resizeMode="cover"
                      />
                    </View>
                  {/* </LinearGradient> */}
                </View>
              </View>

              <Text className="text-4xl font-bold text-white mb-2 tracking-tight">
                AMI
              </Text>
              <View className="h-1 w-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full mb-3" />
              <Text className="text-slate-400 text-center text-sm leading-6 px-8">
                Your personal companion for mental wellness and growth
              </Text>
            </View>

            {/* Signup Form Card */}
            <View className="relative">
              {/* Ambient background glow */}
              <View className="absolute -inset-4 opacity-20">
                <LinearGradient
                  colors={["#3b82f6", "#8b5cf6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="w-full h-full rounded-3xl blur-2xl"
                />
              </View>

              <View className="relative bg-slate-900/60 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10">
                {/* Shimmer effect */}
                <Animated.View
                  style={[
                    shimmerStyle,
                    {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 200,
                      height: "100%",
                      opacity: 0.05,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["transparent", "rgba(255, 255, 255, 0.4)", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="w-full h-full"
                  />
                </Animated.View>

                <LinearGradient
                  colors={[
                    "rgba(59, 130, 246, 0.1)",
                    "rgba(139, 92, 246, 0.05)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute inset-0"
                />

                <View className="p-8">
                  <Text className="text-3xl font-bold text-white text-center mb-2 tracking-tight">
                    Create Account
                  </Text>
                  <Text className="text-slate-400 text-center mb-8 text-sm">
                    Join us and start your wellness journey
                  </Text>

                  {/* Email Input */}
                  <View className="mb-5">
                    <Text className="text-sm font-semibold text-slate-300 mb-2">
                      Email Address
                    </Text>
                    <View className="relative">
                      {focusedField === "email" && (
                        <View className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-50 blur-sm" />
                      )}
                      <LinearGradient
                        colors={
                          focusedField === "email"
                            ? ["rgba(59, 130, 246, 0.2)", "rgba(139, 92, 246, 0.2)"]
                            : ["rgba(30, 41, 59, 0.6)", "rgba(15, 23, 42, 0.8)"]
                        }
                        className="rounded-2xl overflow-hidden border border-slate-700/50"
                      >
                        <TextInput
                          className="px-4 py-4 text-white text-base"
                          placeholder="your.email@example.com"
                          placeholderTextColor="#64748b"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                          value={email}
                          onChangeText={setEmail}
                          onFocus={() => setFocusedField("email")}
                          onBlur={() => setFocusedField(null)}
                          editable={!isLoading}
                          selectionColor="#3b82f6"
                        />
                      </LinearGradient>
                    </View>
                  </View>

                  {/* Password Input */}
                  <View className="mb-5">
                    <Text className="text-sm font-semibold text-slate-300 mb-2">
                      Password
                    </Text>
                    <View className="relative">
                      {focusedField === "password" && (
                        <View className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-50 blur-sm" />
                      )}
                      <LinearGradient
                        colors={
                          focusedField === "password"
                            ? ["rgba(59, 130, 246, 0.2)", "rgba(139, 92, 246, 0.2)"]
                            : ["rgba(30, 41, 59, 0.6)", "rgba(15, 23, 42, 0.8)"]
                        }
                        className="rounded-2xl overflow-hidden border border-slate-700/50"
                      >
                        <TextInput
                          className="px-4 py-4 text-white text-base"
                          placeholder="Min. 6 characters"
                          placeholderTextColor="#64748b"
                          secureTextEntry
                          autoComplete="password-new"
                          value={password}
                          onChangeText={setPassword}
                          onFocus={() => setFocusedField("password")}
                          onBlur={() => setFocusedField(null)}
                          editable={!isLoading}
                          selectionColor="#3b82f6"
                        />
                      </LinearGradient>
                    </View>
                  </View>

                  {/* Confirm Password Input */}
                  <View className="mb-8">
                    <Text className="text-sm font-semibold text-slate-300 mb-2">
                      Confirm Password
                    </Text>
                    <View className="relative">
                      {focusedField === "confirmPassword" && (
                        <View className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-50 blur-sm" />
                      )}
                      <LinearGradient
                        colors={
                          focusedField === "confirmPassword"
                            ? ["rgba(59, 130, 246, 0.2)", "rgba(139, 92, 246, 0.2)"]
                            : ["rgba(30, 41, 59, 0.6)", "rgba(15, 23, 42, 0.8)"]
                        }
                        className="rounded-2xl overflow-hidden border border-slate-700/50"
                      >
                        <TextInput
                          className="px-4 py-4 text-white text-base"
                          placeholder="Re-enter your password"
                          placeholderTextColor="#64748b"
                          secureTextEntry
                          autoComplete="password-new"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          onFocus={() => setFocusedField("confirmPassword")}
                          onBlur={() => setFocusedField(null)}
                          editable={!isLoading}
                          selectionColor="#3b82f6"
                        />
                      </LinearGradient>
                    </View>
                  </View>

                  {/* Sign Up Button */}
                  <TouchableOpacity
                    onPress={handleSignup}
                    disabled={isLoading}
                    activeOpacity={0.85}
                  >
                    <View className="relative mb-6">
                      {!isLoading && (
                        <View className="absolute -inset-1 opacity-50">
                          <LinearGradient
                            colors={["#3b82f6", "#8b5cf6", "#ec4899"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="w-full h-full rounded-2xl blur-lg"
                          />
                        </View>
                      )}

                      <LinearGradient
                        colors={
                          isLoading
                            ? ["#475569", "#334155"]
                            : ["#3b82f6", "#8b5cf6", "#ec4899"]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="rounded-2xl py-4 items-center border border-white/10"
                      >
                        <Text
                          className={`font-bold text-lg tracking-wide ${
                            isLoading ? "text-slate-300" : "text-white"
                          }`}
                        >
                          {isLoading ? "Creating Account..." : "Create Account ✨"}
                        </Text>
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>

                  {/* Sign In Link */}
                  <View className="items-center">
                    <Text className="text-slate-400 text-sm">
                      Already have an account?{" "}
                      <Text
                        className="text-blue-400 font-semibold"
                        onPress={() => !isLoading && router.push("/(auth)/login")}
                      >
                        Sign in
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Terms & Privacy */}
            <View className="mt-8 px-4">
              <Text className="text-slate-500 text-xs text-center leading-5">
                By creating an account, you agree to our{" "}
                <Text className="text-blue-400">Terms of Service</Text> and{" "}
                <Text className="text-blue-400">Privacy Policy</Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}