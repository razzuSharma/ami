import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/app-button";
import { design, gradients } from "../../constants/design";

function AmbientOrb() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.1 }],
    opacity: 0.34 + pulse.value * 0.2,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + pulse.value * 0.08 }],
    opacity: 0.55 + pulse.value * 0.25,
  }));

  return (
    <View style={styles.orbWrap}>
      <Animated.View style={[styles.orbOuter, outerStyle]} />
      <Animated.View style={[styles.orbInner, innerStyle]} />
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <View style={styles.hero}>
          <Animated.View entering={FadeInDown.duration(450).springify()} style={styles.badge}>
            <Text style={styles.badgeText}>Ami Companion</Text>
          </Animated.View>
          <AmbientOrb />
          <Animated.Text entering={FadeInDown.delay(80).duration(460)} style={styles.title}>
            A calmer space for your thoughts.
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(150).duration(460)} style={styles.subtitle}>
            Check in, write freely, and keep a gentle daily rhythm.
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInDown.delay(220).duration(500)} style={styles.actions}>
          <AppButton label="Get started" onPress={() => router.push("/(auth)/signup")} />
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => [styles.linkRow, pressed && styles.linkPressed]}
          >
            <Text style={styles.linkText}>I already have an account</Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: design.space.xl,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: design.radius.pill,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
    marginBottom: 22,
  },
  badgeText: {
    color: design.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  orbWrap: {
    width: 220,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  orbOuter: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(34,211,238,0.25)",
  },
  orbInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(14,165,233,0.45)",
  },
  title: {
    color: design.colors.textPrimary,
    fontSize: 34,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  subtitle: {
    color: design.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  actions: {
    marginBottom: 8,
    gap: 14,
  },
  linkRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkText: {
    color: design.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  linkPressed: {
    opacity: 0.75,
  },
});
