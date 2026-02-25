import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { PlayfairDisplay_600SemiBold_Italic } from "@expo-google-fonts/playfair-display";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import "../global.css";

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (user && inAuthGroup) {
      router.replace("/(tabs)");
      return;
    }

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    }
  }, [user, loading, segments, router]);

  if (loading) {
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
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
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
