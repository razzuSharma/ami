import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={["#1a0f2e", "#2d1b4e", "#1a1625"]}
      className="flex-1"
    >
      <View
        className="flex-1 px-7 justify-between"
        style={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        {/* Hero */}
        <View className="flex-1 items-center justify-center">
          <View
            className="mb-7"
            style={{
              shadowColor: "#7c3aed",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 8,
            }}
          >
            <Image
              source={require("../../assets/images/welcome.png")}
              className="w-[220px] h-[220px]"
              resizeMode="contain"
            />
          </View>
          <Text className="text-[#faf8f5] text-3xl font-bold text-center mb-3">
            Welcome to Ami
          </Text>
          <Text className="text-white/75 text-base text-center leading-6 px-2">
            Your personal companion for mental wellness and daily growth
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-6">
          <Pressable
            onPress={() => router.push("/(auth)/signup")}
            className="rounded-3xl overflow-hidden active:opacity-90"
            style={{
              shadowColor: "#7c3aed",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <LinearGradient
              colors={["#a78bfa", "#7c3aed", "#6d28d9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-5 items-center justify-center"
            >
              <Text className="text-[#faf8f5] text-lg font-bold">
                Get Started
              </Text>
            </LinearGradient>
          </Pressable>

          <View className="flex-row items-center justify-center gap-1.5">
            <Text className="text-white/65 text-[15px]">
              Already have an account?
            </Text>
            <Pressable onPress={() => router.push("/(auth)/login")} hitSlop={8}>
              <Text className="text-violet-400 text-[15px] font-semibold">
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
