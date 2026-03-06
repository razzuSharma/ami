import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { PlayfairDisplay_600SemiBold_Italic } from "@expo-google-fonts/playfair-display";
import { QueryClientProvider } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppStateProvider } from "../contexts/AppStateContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ErrorBoundary } from "../src/shared/components/ErrorBoundary";
import { ToastProvider } from "../src/shared/components/Toast";
import { queryClient } from "../src/shared/lib/queryClient";
import "../global.css";

const requiredEnvVars = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
] as const;

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
  }
});

if (!Constants.expoConfig?.extra?.supabaseUrl) {
  console.error("Missing required config: extra.supabaseUrl");
}
if (!Constants.expoConfig?.extra?.supabaseAnonKey) {
  console.error("Missing required config: extra.supabaseAnonKey");
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingResolved, setOnboardingResolved] = useState(false);

  useEffect(() => {
    if (!loading) return;
    setOnboardingResolved(false);
  }, [loading]);

  useEffect(() => {
    let active = true;

    const syncRouting = async () => {
      if (loading) return;

      const inAuthGroup = segments[0] === "(auth)";
      const inOnboarding = segments[0] === "onboarding";

      if (!user?.id) {
        if (!active) return;
        setOnboardingResolved(true);
        if (!inAuthGroup) {
          router.replace("/(auth)/welcome");
        }
        return;
      }

      const completed = await AsyncStorage.getItem(`onboarding-complete:${user.id}`);
      const requiresOnboarding = completed !== "1";

      if (!active) return;
      setOnboardingResolved(true);

      if (requiresOnboarding && !inOnboarding) {
        router.replace("/onboarding");
        return;
      }

      if (!requiresOnboarding && (inAuthGroup || inOnboarding)) {
        router.replace("/(tabs)");
      }
    };

    void syncRouting();
    return () => {
      active = false;
    };
  }, [loading, router, segments, user?.id]);

  if (loading || (user?.id && !onboardingResolved)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return <Slot />;
}

export default function AppLayout() {
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    PlayfairDisplay_600SemiBold_Italic,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#5ECFB1" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AppStateProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </AppStateProvider>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
