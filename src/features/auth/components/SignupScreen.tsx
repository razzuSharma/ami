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
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/app-button";
import { AppInput } from "../../components/ui/app-input";
import { design, gradients } from "../../constants/design";
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
      const { requiresEmailVerification } = await signUp(trimmedEmail, password);
      if (requiresEmailVerification) {
        router.replace({
          pathname: "/(auth)/login",
          params: { verify: "1", email: trimmedEmail },
        });
        return;
      }
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const rawMessage =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Unable to create account right now.";
      const message =
        rawMessage === "Network request failed"
          ? "Unable to reach Supabase. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then rebuild the app."
          : rawMessage;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + design.space.lg,
              paddingBottom: Math.max(insets.bottom, 20) + 30,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color={design.colors.textPrimary} />
          </Pressable>

          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Start your calm routine with check-ins and journaling.
          </Text>

          <View style={styles.panel}>
            <AppInput
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t: string) => {
                setEmail(t);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            <AppInput
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={(t: string) => {
                setPassword(t);
                setError(null);
              }}
              secureTextEntry
              editable={!loading}
            />

            {error ? (
              <View style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={18} color={design.colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.loadingButton}>
                <ActivityIndicator color={design.colors.textPrimary} />
              </View>
            ) : (
              <AppButton label="Create account" onPress={handleSignUp} />
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: design.space.xl,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: design.colors.surface,
    borderWidth: 1,
    borderColor: design.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: design.space.xl,
  },
  title: {
    color: design.colors.textPrimary,
    fontSize: 34,
    fontWeight: "700",
  },
  subtitle: {
    color: design.colors.textSecondary,
    fontSize: 16,
    marginTop: 6,
    marginBottom: design.space.xl,
    lineHeight: 22,
  },
  panel: {
    backgroundColor: design.colors.surface,
    borderWidth: 1,
    borderColor: design.colors.border,
    borderRadius: design.radius.xl,
    padding: design.space.lg,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.35)",
    backgroundColor: "rgba(251,113,133,0.12)",
    padding: design.space.sm,
    borderRadius: design.radius.md,
    marginBottom: design.space.md,
  },
  errorText: {
    color: "#fecdd3",
    flex: 1,
    fontSize: 13,
  },
  loadingButton: {
    borderRadius: design.radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: design.colors.accentEnd,
  },
  footer: {
    marginTop: design.space.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    color: design.colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: design.colors.accentStart,
    fontSize: 14,
    fontWeight: "700",
  },
});
