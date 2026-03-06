import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import { supabase } from "../../helper/supabaseClient";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ verify?: string; email?: string }>();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsEmailVerification = params.verify === "1";

  useEffect(() => {
    if (typeof params.email === "string" && params.email.length > 0) {
      setEmail(params.email);
    }
  }, [params.email]);

  const handleSignIn = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Unable to sign in right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    setError(null);
    setLoading(true);
    try {
      await supabase.auth.signOut();
      await AsyncStorage.clear();
      router.replace("/(auth)/login");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Unable to reset session right now.";
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

          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Pick up where you left off.</Text>

          <View style={styles.panel}>
            {needsEmailVerification ? (
              <View style={styles.noticeCard}>
                <Ionicons name="mail-outline" size={18} color={design.colors.success} />
                <Text style={styles.noticeText}>Verify your email, then sign in.</Text>
              </View>
            ) : null}

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
              placeholder="Your password"
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
              <AppButton label="Continue" onPress={handleSignIn} />
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Need an account?</Text>
            <Pressable onPress={() => router.push("/(auth)/signup")}>
              <Text style={styles.footerLink}>Create one</Text>
            </Pressable>
          </View>

          <View style={styles.resetRow}>
            <Pressable onPress={handleResetSession} disabled={loading}>
              <Text style={styles.resetLink}>Reset session</Text>
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
  },
  panel: {
    backgroundColor: design.colors.surface,
    borderWidth: 1,
    borderColor: design.colors.border,
    borderRadius: design.radius.xl,
    padding: design.space.lg,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.35)",
    backgroundColor: "rgba(52,211,153,0.12)",
    padding: design.space.sm,
    borderRadius: design.radius.md,
    marginBottom: design.space.md,
  },
  noticeText: {
    color: "#8ce9c8",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
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
  resetRow: {
    marginTop: design.space.md,
    alignItems: "center",
  },
  resetLink: {
    color: "#8fb8ff",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
