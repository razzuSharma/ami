import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppTheme, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../helper/supabaseClient";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [stats, setStats] = useState({ streak: 0, checkins: 0, journal: 0 });
  const [targetStats, setTargetStats] = useState({
    streak: 0,
    checkins: 0,
    journal: 0,
  });
  const [profileName, setProfileName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nameError, setNameError] = useState("");
  const [journalPreview, setJournalPreview] = useState("No entries yet");
  const [moodPreview, setMoodPreview] = useState("No recent check-ins");
  const isEditOpenRef = useRef(false);

  const displayName = useMemo(() => {
    if (profileName.trim()) return profileName.trim();
    return user?.email?.split("@")[0] || "Guest";
  }, [profileName, user?.email]);
  const baselineName = useMemo(
    () => profileName.trim() || user?.email?.split("@")[0] || "",
    [profileName, user?.email],
  );
  const trimmedNameInput = nameInput.trim();
  const canSaveName =
    !savingName &&
    trimmedNameInput.length >= 2 &&
    trimmedNameInput.length <= 40 &&
    trimmedNameInput !== baselineName;

  useEffect(() => {
    const target = targetStats;
    const start = stats;
    const duration = 900;
    const steps = 24;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      const ratio = Math.min(1, tick / steps);
      setStats({
        streak: Math.round(start.streak + (target.streak - start.streak) * ratio),
        checkins: Math.round(
          start.checkins + (target.checkins - start.checkins) * ratio,
        ),
        journal: Math.round(start.journal + (target.journal - start.journal) * ratio),
      });
      if (tick >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [targetStats]);

  useEffect(() => {
    isEditOpenRef.current = isEditOpen;
  }, [isEditOpen]);

  const loadProfileData = useCallback(
    async (asRefresh = false) => {
      if (!user) {
        setStats({ streak: 0, checkins: 0, journal: 0 });
        setTargetStats({ streak: 0, checkins: 0, journal: 0 });
        setProfileName("");
        setNameInput("");
        setJournalPreview("No entries yet");
        setMoodPreview("No recent check-ins");
        setLoadError("");
        setLoadingProfile(false);
        setRefreshing(false);
        return;
      }

      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoadingProfile(true);
      }
      setLoadError("");

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDayStart = toLocalDateKey(sevenDaysAgo);

      const [
        { count: checkinsCount, error: checkinsError },
        { count: journalCount, error: journalCountError },
        { data: streakRows, error: streakError },
        { data: nameData, error: nameLoadError },
        { data: lastJournal, error: lastJournalError },
        { data: weekMoods, error: weekMoodError },
      ] = await Promise.all([
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
        supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("journal_entries")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("daily_checkins")
          .select("mood,date")
          .eq("user_id", user.id)
          .gte("date", sevenDayStart)
          .order("date", { ascending: false }),
      ]);

      const loadErrors = [
        checkinsError,
        journalCountError,
        streakError,
        nameLoadError,
        lastJournalError,
        weekMoodError,
      ].filter(Boolean);

      if (loadErrors.length > 0) {
        console.warn(
          "Failed to load some profile data:",
          loadErrors
            .map((error) => error?.message)
            .filter((message): message is string => Boolean(message))
            .join(" | "),
        );
        setLoadError("Some profile data could not be refreshed.");
      }

      setTargetStats({
        streak: calculateStreak(streakRows?.map((row) => row.date) ?? []),
        checkins: checkinsCount ?? 0,
        journal: journalCount ?? 0,
      });

      const nextName = nameData?.full_name?.trim() || "";
      setProfileName(nextName);
      if (!isEditOpenRef.current) {
        setNameInput(nextName || user.email?.split("@")[0] || "");
      }

      if (lastJournal?.created_at) {
        const formatted = new Date(lastJournal.created_at).toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
          },
        );
        setJournalPreview(`Last entry · ${formatted}`);
      } else {
        setJournalPreview("No entries yet");
      }

      const validMoods = (weekMoods ?? [])
        .map((row) => row.mood)
        .filter((value): value is number => typeof value === "number");
      if (validMoods.length === 0) {
        setMoodPreview("No recent check-ins");
      } else {
        const avg = validMoods.reduce((sum, val) => sum + val, 0) / validMoods.length;
        const tone =
          avg < 1.75 ? "Low" : avg < 2.5 ? "Flat" : avg < 3.25 ? "Good" : "Great";
        setMoodPreview(`${tone} avg · ${validMoods.length}/7 days`);
      }

      setLoadingProfile(false);
      setRefreshing(false);
    },
    [user],
  );

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const saveProfileName = async () => {
    if (!user) return;
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 40) {
      setNameError("Name can be at most 40 characters.");
      return;
    }
    if (trimmed === baselineName) {
      setNameError("No changes to save.");
      return;
    }

    setSavingName(true);
    const { error } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: trimmed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    setSavingName(false);

    if (error) {
      console.warn("Failed to save profile name:", error.message);
      setNameError("Could not save name. Please try again.");
      return;
    }

    setNameError("");
    setProfileName(trimmed);
    setIsEditOpen(false);
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setIsLogoutConfirmOpen(false);
      router.replace("/(auth)/welcome");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProfileData(true)}
              tintColor={AppTheme.colors.accentPrimary}
            />
          }
        >
          <Animated.View
            entering={FadeInDown.duration(360)}
            style={styles.hero}
          >
            <AvatarRing />
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              <Pressable
                onPress={() => setIsEditOpen(true)}
                style={({ pressed }) => [
                  styles.editNameIconBtn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Edit profile name"
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={AppTheme.colors.accentPrimary}
                />
              </Pressable>
            </View>
            <Text style={styles.email}>
              {user?.email ?? "No account connected"}
            </Text>
            {loadingProfile ? (
              <Text style={styles.loadingHint}>Refreshing profile...</Text>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(100).duration(420)}
            style={styles.statsRow}
          >
            <StatCard label="Streak" value={`${stats.streak}d`} highlight />
            <StatCard label="Check-ins" value={`${stats.checkins}`} />
            <StatCard label="Journal" value={`${stats.journal}`} />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(160).duration(450)}
            style={styles.menu}
          >
            {loadError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable
                  onPress={() => loadProfileData(true)}
                  style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            <MenuItem
              icon="book-outline"
              label="Journal history"
              preview={journalPreview}
              onPress={() => router.push("/journal")}
            />
            <MenuItem
              icon="trending-up-outline"
              label="Mood trends"
              preview={moodPreview}
              onPress={() => router.push("/mood-trends")}
            />
            <MenuItem
              icon="options-outline"
              label="Preferences"
              preview={`${displayName} · ${user?.email ?? "No email"}`}
              onPress={() => setIsEditOpen(true)}
            />
            <MenuItem
              label="Log Out"
              tone="danger"
              showChevron={false}
              onPress={() => setIsLogoutConfirmOpen(true)}
            />
          </Animated.View>
        </ScrollView>

        <Modal
          visible={isEditOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit profile name</Text>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={(value) => {
                  setNameInput(value);
                  if (nameError) setNameError("");
                }}
                placeholder="Your name"
                placeholderTextColor={AppTheme.colors.textMuted}
                autoCapitalize="words"
                maxLength={40}
              />
              {nameError ? <Text style={styles.nameErrorText}>{nameError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setIsEditOpen(false)}
                  style={({ pressed }) => [
                    styles.modalGhostBtn,
                    pressed && styles.pressed,
                  ]}
                  disabled={savingName}
                >
                  <Text style={styles.modalGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveProfileName}
                  style={({ pressed }) => [
                    styles.modalSaveBtn,
                    pressed && styles.pressed,
                    !canSaveName && styles.buttonDisabled,
                  ]}
                  disabled={!canSaveName}
                >
                  <Text style={styles.modalSaveText}>
                    {savingName ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isLogoutConfirmOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsLogoutConfirmOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Log Out</Text>
              <Text style={styles.logoutConfirmText}>
                Are you sure you want to log out?
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setIsLogoutConfirmOpen(false)}
                  style={({ pressed }) => [
                    styles.modalGhostBtn,
                    pressed && styles.pressed,
                  ]}
                  disabled={signingOut}
                >
                  <Text style={styles.modalGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.modalDangerBtn,
                    pressed && styles.pressed,
                  ]}
                  disabled={signingOut}
                >
                  <Text style={styles.modalDangerText}>
                    {signingOut ? "Logging out..." : "Log Out"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

function calculateStreak(sortedDateStrings: string[]) {
  if (sortedDateStrings.length === 0) return 0;
  const uniqueDates = Array.from(
    new Set(sortedDateStrings.map((dateString) => dateString.slice(0, 10))),
  );
  const dateSet = new Set(uniqueDates);

  const today = new Date();

  let current = new Date(today);
  let streak = 0;

  if (!dateSet.has(toLocalDateKey(current))) {
    current.setDate(current.getDate() - 1);
  }

  while (dateSet.has(toLocalDateKey(current))) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

function toLocalDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function AvatarRing() {
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 10000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotate]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  return (
    <View style={styles.avatarFrame}>
      <Animated.View style={[styles.avatarRing, ringStyle]}>
        <LinearGradient
          colors={gradients.tealAccent}
          style={styles.avatarRingFill}
        />
      </Animated.View>
      <Image
        source={require("../../assets/images/image-ami.png")}
        style={styles.avatar}
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    if (!highlight) return;
    shimmer.value = withRepeat(
      withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
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
          <LinearGradient
            colors={["transparent", "rgba(196,168,130,0.45)", "transparent"]}
            style={styles.shimmer}
          />
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
  onPress,
  tone = "default",
  showChevron = true,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  preview?: string;
  onPress?: () => void;
  tone?: "default" | "danger";
  showChevron?: boolean;
}) {
  const isDanger = tone === "danger";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuPress, pressed && styles.pressed]}
    >
      {isDanger ? (
        <View style={styles.logoutButtonItem}>
          <Text style={styles.logoutButtonText}>{label}</Text>
        </View>
      ) : (
        <View style={styles.menuItem}>
          <View style={styles.menuLeft}>
            {icon ? (
              <View style={styles.menuIcon}>
                <Ionicons
                  name={icon}
                  size={19}
                  color={AppTheme.colors.accentPrimary}
                />
              </View>
            ) : null}
            <View style={styles.menuBody}>
              <Text style={styles.menuLabel}>{label}</Text>
              {preview ? <Text style={styles.menuPreview}>{preview}</Text> : null}
            </View>
          </View>
          {showChevron ? (
            <View style={styles.previewIconWrap}>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={AppTheme.colors.textMuted}
              />
            </View>
          ) : null}
        </View>
      )}
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
  },
  nameRow: {
    marginTop: 4,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  email: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  loadingHint: {
    marginTop: 8,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
  },
  editNameIconBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    borderRadius: 16,
    backgroundColor: "rgba(94,207,177,0.08)",
    alignItems: "center",
    justifyContent: "center",
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
  errorBanner: {
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(232,112,112,0.35)",
    backgroundColor: "rgba(232,112,112,0.08)",
    paddingHorizontal: AppTheme.space.md,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  errorText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
    flex: 1,
  },
  retryBtn: {
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 12,
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
  logoutButtonItem: {
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1.5,
    borderColor: AppTheme.colors.danger,
    backgroundColor: "transparent",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonText: {
    color: AppTheme.colors.danger,
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

  // ── Sign out — redesigned ──────────────────────────────────────────────────
  signOutBtn: {
    width: "100%",
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: AppTheme.colors.danger,
    borderRadius: AppTheme.radius.lg,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginTop: 10,
  },
  signOutPressed: {
    backgroundColor: "rgba(232,112,112,0.07)",
    opacity: 0.9,
  },
  signOutText: {
    color: AppTheme.colors.danger,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  // ─────────────────────────────────────────────────────────────────────────

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: AppTheme.space.xl,
  },
  modalCard: {
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    padding: AppTheme.space.lg,
  },
  modalTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 18,
    marginBottom: 10,
  },
  nameInput: {
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  nameErrorText: {
    marginTop: 8,
    color: AppTheme.colors.danger,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
  },
  modalGhostBtn: {
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalGhostText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
  },
  modalSaveBtn: {
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.accentPrimary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  modalSaveText: {
    color: AppTheme.colors.background,
    fontFamily: AppTheme.fonts.bodyBold,
  },
  logoutConfirmText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
    marginBottom: 4,
  },
  modalDangerBtn: {
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.danger,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  modalDangerText: {
    color: AppTheme.colors.background,
    fontFamily: AppTheme.fonts.bodyBold,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
