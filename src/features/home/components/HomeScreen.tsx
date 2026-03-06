import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { AppTheme, gradients } from "../../constants/design";
import { useAppState } from "../../contexts/AppStateContext";
import { useAuth } from "../../contexts/AuthContext";
import { scheduleDailyReminder, setupNotificationListener } from "../../helper/notifications";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { notificationsInitialized, setNotificationsInitialized } = useAppState();
  const displayName = user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "friend";

  useEffect(() => {
    let active = true;
    let notificationSubscription: { remove?: () => void } | null = null;

    const setupNotifications = async () => {
      if (notificationsInitialized) return;
      try {
        notificationSubscription = await setupNotificationListener();
        await scheduleDailyReminder();
        if (active) {
          setNotificationsInitialized(true);
        }
      } catch (error) {
        console.warn("Failed to set up notifications:", error);
      }
    };

    setupNotifications();

    return () => {
      active = false;
      notificationSubscription?.remove?.();
    };
  }, [notificationsInitialized, setNotificationsInitialized]);

  const handleOpenChat = useCallback(() => router.push("/chat"), [router]);
  const handleOpenJournal = useCallback(() => router.push("/journal"), [router]);
  const handleOpenCheckins = useCallback(() => router.push("/checkins"), [router]);

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.eyebrow}>Good evening</Text>
              <Text style={styles.topTitle}>{displayName}</Text>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(420)} style={styles.heroFrame}>
            <HeroMesh />
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>How are you feeling today?</Text>
              <Text style={styles.heroSub}>Stay grounded with one mindful check-in.</Text>
            </View>
            <ExpoImage
              source={require("../../../../assets/images/image-ami.png")}
              style={styles.heroAvatar}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(440)} style={styles.section}>
            <FeatureCard
              accentColor={AppTheme.colors.accentPrimary}
              icon="sparkles-outline"
              title="Talk to Ami"
              description="A short guided chat to settle your thoughts."
              onPress={handleOpenChat}
            />
            <FeatureCard
              accentColor={AppTheme.colors.accentSecondary}
              icon="book-outline"
              title="Open Journal"
              description="Capture one honest paragraph before bed."
              onPress={handleOpenJournal}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(460)}>
            <DailyRhythmCard onPress={handleOpenCheckins} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function HeroMesh() {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 5500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [drift]);

  const orbOne = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value * 24 }, { translateY: drift.value * -12 }],
  }));
  const orbTwo = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.value * -18 }, { translateY: drift.value * 16 }],
  }));

  return (
    <LinearGradient colors={gradients.heroMesh} style={styles.meshBase}>
      <Animated.View style={[styles.meshOrbTeal, orbOne]} />
      <Animated.View style={[styles.meshOrbBlue, orbTwo]} />
    </LinearGradient>
  );
}

function FeatureCard({
  accentColor,
  icon,
  title,
  description,
  onPress,
}: {
  accentColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.featurePress, pressed && styles.pressed]}>
      <View style={styles.featureCard}>
        <View style={[styles.featureAccent, { backgroundColor: accentColor }]} />
        <View style={styles.featureIconWrap}>
          <Ionicons name={icon} size={24} color={accentColor} />
        </View>
        <View style={styles.featureBody}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={AppTheme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

function DailyRhythmCard({ onPress }: { onPress: () => void }) {
  const bounce = useSharedValue(0);
  const progress = 0.62;

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + bounce.value * 0.08 }],
  }));

  const handlePress = () => {
    bounce.value = withSpring(1, { damping: 7, stiffness: 180 }, () => {
      bounce.value = withTiming(0, { duration: 180 });
    });
    onPress();
  };

  return (
    <View style={styles.rhythmCard}>
      <View style={styles.rhythmHeader}>
        <Text style={styles.rhythmTitle}>Daily Rhythm</Text>
        <View style={styles.timeBadge}>
          <Text style={styles.timeBadgeText}>2 min</Text>
        </View>
      </View>

      <Text style={styles.rhythmSub}>Today&apos;s consistency</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.rhythmFooter}>
        <Text style={styles.progressLabel}>62% completed</Text>
        <Pressable onPress={handlePress}>
          <Animated.View style={[styles.ctaCircle, bounceStyle]}>
            <Ionicons name="arrow-forward" size={16} color={AppTheme.colors.background} />
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  content: {
    paddingHorizontal: AppTheme.space.xl,
    paddingBottom: 132,
    paddingTop: 10,
    gap: AppTheme.space.lg,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  topTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 34,
    marginTop: 4,
  },
  heroFrame: {
    borderRadius: AppTheme.radius.xl,
    overflow: "hidden",
    minHeight: 220,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
  },
  meshBase: {
    ...StyleSheet.absoluteFillObject,
  },
  meshOrbTeal: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(94,207,177,0.25)",
    top: -38,
    left: -30,
  },
  meshOrbBlue: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(74,122,186,0.26)",
    bottom: -60,
    right: -40,
  },
  heroContent: {
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.xl,
    maxWidth: 255,
  },
  heroTitle: {
    color: AppTheme.colors.textPrimary,
    fontSize: 40,
    lineHeight: 44,
    fontFamily: AppTheme.fonts.serifDisplay,
    marginBottom: 10,
  },
  heroSub: {
    color: AppTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: AppTheme.fonts.bodyRegular,
  },
  heroAvatar: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 12,
  },
  section: {
    gap: 12,
  },
  featurePress: {
    borderRadius: AppTheme.radius.lg,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    overflow: "hidden",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  featureAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  featureBody: {
    flex: 1,
  },
  featureTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 16,
    marginBottom: 3,
  },
  featureDescription: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  rhythmCard: {
    borderRadius: AppTheme.radius.xl,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    padding: AppTheme.space.lg,
    overflow: "hidden",
  },
  rhythmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  rhythmTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 18,
  },
  timeBadge: {
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(196,168,130,0.2)",
    borderWidth: 1,
    borderColor: "rgba(196,168,130,0.55)",
  },
  timeBadgeText: {
    color: AppTheme.colors.accentSecondary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 12,
  },
  rhythmSub: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
    marginBottom: 10,
  },
  progressTrack: {
    height: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 9,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: AppTheme.colors.accentPrimary,
    borderRadius: 9,
  },
  rhythmFooter: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  ctaCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.accentPrimary,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
