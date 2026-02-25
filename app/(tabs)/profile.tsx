import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppTheme, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../helper/supabaseClient";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [stats, setStats] = useState({ streak: 0, checkins: 0, journal: 0 });
  const [targetStats, setTargetStats] = useState({ streak: 0, checkins: 0, journal: 0 });

  const displayName = useMemo(
    () => user?.email?.split("@")[0] || "Guest",
    [user?.email]
  );

  useEffect(() => {
    const target = targetStats;
    const duration = 900;
    const steps = 24;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      const ratio = Math.min(1, tick / steps);
      setStats({
        streak: Math.round(target.streak * ratio),
        checkins: Math.round(target.checkins * ratio),
        journal: Math.round(target.journal * ratio),
      });
      if (tick >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [targetStats]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      const [{ count: checkinsCount }, { count: journalCount }, { data: streakRows }] =
        await Promise.all([
          supabase
            .from("daily_checkins")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("journal_entries")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("daily_checkins")
            .select("date")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .limit(120),
        ]);

      const streak = calculateStreak(streakRows?.map((row) => row.date) ?? []);

      setTargetStats({
        streak,
        checkins: checkinsCount ?? 0,
        journal: journalCount ?? 0,
      });
    };

    loadStats();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace("/(auth)/welcome");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(360)} style={styles.hero}>
            <AvatarRing />
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{user?.email ?? "No account connected"}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(420)} style={styles.statsRow}>
            <StatCard label="Streak" value={`${stats.streak}d`} highlight />
            <StatCard label="Check-ins" value={`${stats.checkins}`} />
            <StatCard label="Journal" value={`${stats.journal}`} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(450)} style={styles.menu}>
            <MenuItem icon="book-outline" label="Journal history" preview="Last entry · Tonight" />
            <MenuItem icon="trending-up-outline" label="Mood trends" preview="Steady this week" />
            <MenuItem icon="options-outline" label="Preferences" preview="Notifications · 7:00 AM" />
          </Animated.View>
        </ScrollView>

        <View style={styles.signOutWrap}>
          <Pressable onPress={handleLogout} style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function calculateStreak(sortedDateStrings: string[]) {
  if (sortedDateStrings.length === 0) return 0;
  const uniqueDates = Array.from(new Set(sortedDateStrings));
  const dateSet = new Set(uniqueDates);

  const today = new Date();
  const toDateOnly = (d: Date) => d.toISOString().split("T")[0];

  let current = new Date(today);
  let streak = 0;

  if (!dateSet.has(toDateOnly(current))) {
    current.setDate(current.getDate() - 1);
  }

  while (dateSet.has(toDateOnly(current))) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function AvatarRing() {
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 10000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotate]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  return (
    <View style={styles.avatarFrame}>
      <Animated.View style={[styles.avatarRing, ringStyle]}>
        <LinearGradient colors={gradients.tealAccent} style={styles.avatarRingFill} />
      </Animated.View>
      <Image source={require("../../assets/images/image-ami.png")} style={styles.avatar} />
    </View>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    if (!highlight) return;
    shimmer.value = withRepeat(
      withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [highlight, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 120 }],
    opacity: highlight ? 0.3 : 0,
  }));

  return (
    <View style={styles.statCard}>
      {highlight ? (
        <Animated.View style={[styles.shimmerWrap, shimmerStyle]}>
          <LinearGradient colors={["transparent", "rgba(196,168,130,0.45)", "transparent"]} style={styles.shimmer} />
        </Animated.View>
      ) : null}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  preview,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  preview: string;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuPress, pressed && styles.pressed]}>
      <View style={styles.menuItem}>
        <View style={styles.menuLeft}>
          <View style={styles.menuIcon}>
            <Ionicons name={icon} size={19} color={AppTheme.colors.accentPrimary} />
          </View>
          <View style={styles.menuBody}>
            <Text style={styles.menuLabel}>{label}</Text>
            <Text style={styles.menuPreview}>{preview}</Text>
          </View>
        </View>
        <View style={styles.previewIconWrap}>
          <Ionicons name="chevron-forward" size={18} color={AppTheme.colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.colors.background,
  },
  content: {
    paddingHorizontal: AppTheme.space.xl,
    paddingTop: 16,
    paddingBottom: 130,
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarFrame: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarRing: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    padding: 2,
  },
  avatarRingFill: {
    flex: 1,
    borderRadius: 55,
  },
  avatar: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  name: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 42,
    lineHeight: 46,
    marginBottom: 2,
  },
  email: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minHeight: 150,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shimmerWrap: {
    position: "absolute",
    top: -20,
    left: -80,
    width: 80,
    height: 220,
  },
  shimmer: {
    width: "100%",
    height: "100%",
  },
  statValue: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.statItalic,
    fontSize: 44,
    lineHeight: 50,
  },
  statLabel: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
    marginTop: 3,
  },
  menu: {
    gap: 12,
  },
  menuPress: {
    borderRadius: AppTheme.radius.lg,
  },
  menuItem: {
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    paddingHorizontal: AppTheme.space.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(94,207,177,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuBody: {
    flex: 1,
  },
  menuLabel: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 16,
  },
  menuPreview: {
    marginTop: 3,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
  },
  previewIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutWrap: {
    position: "absolute",
    left: AppTheme.space.xl,
    right: AppTheme.space.xl,
    bottom: 98,
  },
  signOutBtn: {
    borderWidth: 1,
    borderColor: AppTheme.colors.danger,
    borderRadius: AppTheme.radius.lg,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,112,112,0.08)",
  },
  signOutText: {
    color: AppTheme.colors.danger,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
