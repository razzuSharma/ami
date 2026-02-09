import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUp(trimmedEmail, password);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#1a0f2e", "#2d1b4e", "#1a1625"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 24) + 80,
            paddingHorizontal: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          {/* Back */}
          <Pressable
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full border border-white/15 bg-white/[0.08] items-center justify-center mb-8"
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={26} color="#faf8f5" />
          </Pressable>

          {/* Header */}
          <View className="mb-10">
            <Text className="text-[#faf8f5] text-3xl font-bold mb-2">
              Create account
            </Text>
            <Text className="text-white/70 text-base leading-6">
              Join Ami and start your wellness journey
            </Text>
          </View>

          {/* Form */}
          <View className="mb-8">
            <Text className="text-violet-300 text-sm font-semibold uppercase tracking-wide mb-2">
              Email
            </Text>
            <TextInput
              className="bg-white/[0.06] rounded-2xl border border-white/15 px-5 py-4 text-base text-[#faf8f5]"
              placeholder="you@example.com"
              placeholderTextColor="#a78bfa"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <Text className="text-violet-300 text-sm font-semibold uppercase tracking-wide mt-5 mb-2">
              Password
            </Text>
            <TextInput
              className="bg-white/[0.06] rounded-2xl border border-white/15 px-5 py-4 text-base text-[#faf8f5]"
              placeholder="At least 6 characters"
              placeholderTextColor="#a78bfa"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              secureTextEntry
              editable={!loading}
            />

            {error ? (
              <View className="flex-row items-center gap-2.5 mt-4 py-3 px-4 rounded-2xl bg-red-500/10 border border-red-400/30">
                <Ionicons name="alert-circle-outline" size={18} color="#fca5a5" />
                <Text className="flex-1 text-red-300 text-sm">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSignUp}
              disabled={loading}
              className={`mt-7 rounded-3xl overflow-hidden ${loading ? "opacity-90" : ""}`}
              style={{
                shadowColor: "#7c3aed",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 14,
                elevation: 8,
              }}
            >
              <LinearGradient
                colors={
                  loading
                    ? ["#6b21a8", "#5b21b6"]
                    : ["#a78bfa", "#7c3aed", "#6d28d9"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="py-5 items-center justify-center"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#faf8f5" />
                ) : (
                  <Text className="text-[#faf8f5] text-lg font-bold">
                    Sign up
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-center gap-1.5 mt-6">
            <Text className="text-white/65 text-[15px]">
              Already have an account?
            </Text>
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              disabled={loading}
              hitSlop={8}
            >
              <Text className="text-violet-400 text-[15px] font-semibold">
                Sign in
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
