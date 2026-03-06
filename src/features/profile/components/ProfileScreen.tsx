import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppTheme, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import {
  clearUserContextFacts,
  forgetUserContextFact,
  loadUserContextFacts,
  type UserContextMemory,
} from "../../helper/companion";
import { moodEmojiFromValue, moodLabelFromValue, moodScoreFromValue } from "../../helper/mood";
import { clearProfileCache } from "../../helper/profileCache";
import { supabase } from "../../helper/supabaseClient";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { useToast } from "../../../shared/components/Toast";

type JournalPreview = {
  id: string;
  preview: string;
  moodLabel: string;
  dateLabel: string;
};

type ProfileData = {
  profileName: string;
  companionName: string;
  email: string;
  streak: number;
  checkins: number;
  journal: number;
  avgMoodEmoji: string;
  avgMoodLabel: string;
  journalHistory: JournalPreview[];
  sparkline: number[];
  memories: UserContextMemory[];
};

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function calculateStreak(dateStrings: string[]) {
  if (dateStrings.length === 0) return 0;
  const dateSet = new Set(dateStrings.map((dateString) => dateString.slice(0, 10)));
  const current = new Date();
  let streak = 0;
  if (!dateSet.has(toDateKey(current))) {
    current.setDate(current.getDate() - 1);
  }
  while (dateSet.has(toDateKey(current))) {
    streak += 1;
    current.setDate(current.getDate() - 1);
  }
  return streak;
}

function buildSparkPath(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return "";
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = padding + index * step;
      const ratio = (value - 1) / 4;
      const y = height - padding - ratio * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function CountUpNumber({
  value,
  suffix = "",
  style,
}: {
  value: number;
  suffix?: string;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: current }) => {
      setDisplay(Math.round(current));
    });
    Animated.timing(anim, {
      toValue: value,
      duration: 800,
      useNativeDriver: false,
    }).start();
    return () => {
      anim.removeListener(id);
    };
  }, [anim, value]);

  return <Text style={style}>{display}{suffix}</Text>;
}

function AvatarRing() {
  const rotate = useSharedValue(0);
  useEffect(() => {
    rotate.value = withRepeat(withTiming(360, { duration: 10000, easing: Easing.linear }), -1, false);
  }, [rotate]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotate.value}deg` }] }));
  return (
    <View style={styles.avatarFrame}>
      <Reanimated.View style={[styles.avatarRing, ringStyle]}>
        <LinearGradient colors={gradients.tealAccent} style={styles.avatarRingFill} />
      </Reanimated.View>
      <ExpoImage
        source={require("../../../../assets/images/image-ami.png")}
        style={styles.avatar}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  context,
  suffix,
}: {
  label: string;
  value: number;
  context: string;
  suffix?: string;
}) {
  return (
    <View style={styles.statCard}>
      <CountUpNumber value={value} suffix={suffix} style={styles.statValue} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statContext}>{context}</Text>
    </View>
  );
}

function SkeletonBlock() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonLine, { width: "30%" }]} />
      <View style={[styles.skeletonLine, { width: "85%", marginTop: 10 }]} />
      <View style={[styles.skeletonLine, { width: "65%", marginTop: 8 }]} />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { show } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCompanionEditOpen, setIsCompanionEditOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [companionNameInput, setCompanionNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [companionNameError, setCompanionNameError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const profileQuery = useQuery({
    queryKey: queryKeys.profileDashboard(user?.id ?? "anonymous"),
    enabled: Boolean(user?.id),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ProfileData> => {
      if (!user?.id) {
        return {
          profileName: "",
          companionName: "",
          email: "",
          streak: 0,
          checkins: 0,
          journal: 0,
          avgMoodEmoji: "😌",
          avgMoodLabel: "Calm",
          journalHistory: [],
          sparkline: [3, 3, 3, 3, 3, 3, 3],
          memories: [],
        };
      }

      const now = new Date();
      const last30 = new Date(now);
      last30.setDate(last30.getDate() - 29);
      const last7 = new Date(now);
      last7.setDate(last7.getDate() - 6);

      const [
        { data: nameData },
        { count: checkinsCount },
        { count: journalCount },
        { data: streakRows },
        { data: journalRows },
        { data: moods30Rows },
        { data: moods7Rows },
        memories,
        companionNameStored,
      ] = await Promise.all([
        supabase.from("users").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("daily_checkins").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("daily_checkins").select("date").eq("user_id", user.id).order("date", { ascending: false }).limit(120),
        supabase.from("journal_entries").select("id,content,mood,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("daily_checkins").select("mood,date").eq("user_id", user.id).gte("date", toDateKey(last30)),
        supabase.from("daily_checkins").select("mood,date").eq("user_id", user.id).gte("date", toDateKey(last7)),
        loadUserContextFacts(user.id, 6),
        AsyncStorage.getItem(`companion-name:${user.id}`),
      ]);

      const streak = calculateStreak((streakRows ?? []).map((row) => row.date));

      const moodCounts = new Map<string, number>();
      for (const row of moods30Rows ?? []) {
        const label = moodLabelFromValue(row.mood);
        moodCounts.set(label, (moodCounts.get(label) ?? 0) + 1);
      }
      const topMoodLabel =
        Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
        ?? "Calm";
      const avgMoodEmoji = moodEmojiFromValue(topMoodLabel);

      const sparkMap = new Map<string, number>();
      for (const row of moods7Rows ?? []) {
        sparkMap.set(row.date, moodScoreFromValue(row.mood));
      }
      const sparkline = Array.from({ length: 7 }).map((_, idx) => {
        const day = new Date(last7);
        day.setDate(last7.getDate() + idx);
        return sparkMap.get(toDateKey(day)) ?? 3;
      });

      const journalHistory: JournalPreview[] = (journalRows ?? []).map((entry) => {
        const text = String(entry.content ?? "").replace(/\s+/g, " ").trim();
        const preview = text.length > 90 ? `${text.slice(0, 90)}...` : text || "No text";
        const moodLabel = entry.mood ? String(entry.mood) : moodLabelFromValue(text);
        return {
          id: entry.id,
          preview,
          moodLabel,
          dateLabel: new Date(entry.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        };
      });

      return {
        profileName: nameData?.full_name?.trim() || "",
        companionName: companionNameStored?.trim() || "Companion",
        email: user.email || "",
        streak,
        checkins: checkinsCount ?? 0,
        journal: journalCount ?? 0,
        avgMoodEmoji,
        avgMoodLabel: topMoodLabel,
        journalHistory,
        sparkline,
        memories,
      };
    },
  });

  const saveNameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error("Missing user");
      const { error } = await supabase.from("users").upsert(
        {
          id: user.id,
          email: user.email,
          full_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setIsEditOpen(false);
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profileDashboard(user.id) });
      }
    },
    onError: () => {
      show("Could not update profile name.");
    },
  });

  const saveCompanionNameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error("Missing user");
      const key = `companion-name:${user.id}`;
      await AsyncStorage.setItem(key, name);
    },
    onSuccess: async () => {
      setIsCompanionEditOpen(false);
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profileDashboard(user.id) });
      }
    },
    onError: () => {
      show("Could not update companion name.");
    },
  });

  const forgetMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      if (!user?.id) throw new Error("Missing user");
      await forgetUserContextFact(user.id, memoryId);
    },
    onSuccess: async () => {
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profileDashboard(user.id) });
      }
    },
    onError: () => {
      show("Could not remove memory.");
    },
  });

  const clearMemoryMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Missing user");
      await clearUserContextFacts(user.id);
    },
    onSuccess: async () => {
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.profileDashboard(user.id) });
      }
      show("Ami memory cleared.");
    },
    onError: () => {
      show("Could not clear memories.");
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await profileQuery.refetch();
    setRefreshing(false);
  }, [profileQuery]);

  const handleOpenEdit = () => {
    setNameError("");
    setNameInput(profileQuery.data?.profileName || user?.email?.split("@")[0] || "");
    setIsEditOpen(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 40) {
      setNameError("Name can be at most 40 characters.");
      return;
    }
    saveNameMutation.mutate(trimmed);
  };

  const handleOpenCompanionEdit = () => {
    setCompanionNameError("");
    setCompanionNameInput(profile?.companionName || "Companion");
    setIsCompanionEditOpen(true);
  };

  const handleSaveCompanionName = () => {
    const trimmed = companionNameInput.trim();
    if (trimmed.length < 2) {
      setCompanionNameError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 24) {
      setCompanionNameError("Name can be at most 24 characters.");
      return;
    }
    saveCompanionNameMutation.mutate(trimmed);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.clear();
      clearProfileCache();
      setIsLogoutConfirmOpen(false);
      router.replace("/(auth)/login");
    } catch {
      // no-op
    }
  };

  const profile = profileQuery.data;
  const svgSupported = useMemo(() => {
    try {
      return Boolean(UIManager.getViewManagerConfig?.("RNSVGPath"));
    } catch {
      return false;
    }
  }, []);
  const displayName = useMemo(() => {
    if (profile?.profileName?.trim()) return profile.profileName.trim();
    return user?.email?.split("@")[0] || "Guest";
  }, [profile?.profileName, user?.email]);

  const sparkPath = useMemo(
    () => buildSparkPath(profile?.sparkline ?? [3, 3, 3, 3, 3, 3, 3], 240, 60, 6),
    [profile?.sparkline],
  );

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={AppTheme.colors.accentPrimary}
            />
          }
        >
          <Reanimated.View entering={FadeInDown.duration(360)} style={styles.hero}>
            <AvatarRing />
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              <Pressable onPress={handleOpenEdit} style={({ pressed }) => [styles.editNameIconBtn, pressed && styles.pressed]}>
                <Ionicons name="create-outline" size={16} color={AppTheme.colors.accentPrimary} />
              </Pressable>
            </View>
            <Text style={styles.email}>{profile?.email || user?.email || "No account connected"}</Text>
          </Reanimated.View>

          {profileQuery.isLoading ? (
            <>
              <SkeletonBlock />
              <SkeletonBlock />
            </>
          ) : profileQuery.isError ? (
            <View style={styles.sectionCard}>
              <Text style={styles.emptyHistoryText}>Couldn&apos;t load profile data.</Text>
              <Pressable onPress={() => profileQuery.refetch()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Reanimated.View entering={FadeInDown.delay(80).duration(420)} style={styles.statsGrid}>
                <StatCard label="Streak" value={profile?.streak ?? 0} suffix="d" context={(profile?.streak ?? 0) > 0 ? "Keep it up! 🔥" : "Start your streak today"} />
                <StatCard label="Check-ins" value={profile?.checkins ?? 0} context="This month" />
                <StatCard label="Journal" value={profile?.journal ?? 0} context="Entries written" />
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{profile?.avgMoodEmoji ?? "😌"}</Text>
                  <Text style={styles.statLabel}>Avg Mood</Text>
                  <Text style={styles.statContext}>{profile?.avgMoodLabel ?? "Calm"}</Text>
                </View>
              </Reanimated.View>

              <Reanimated.View entering={FadeInDown.delay(130).duration(440)} style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Mood trend · last 7 days</Text>
                  <Pressable onPress={() => router.push("/mood-trends")}>
                    <Text style={styles.sectionLink}>Open</Text>
                  </Pressable>
                </View>
                <View style={styles.sparklineWrap}>
                  {svgSupported ? (
                    <Svg width={240} height={60}>
                      <Path d={sparkPath} stroke="#5ECFB1" strokeWidth={2.5} fill="none" />
                    </Svg>
                  ) : (
                    <View style={styles.sparkFallbackRow}>
                      {(profile?.sparkline ?? [3, 3, 3, 3, 3, 3, 3]).map((point, idx) => (
                        <View key={`${point}-${idx}`} style={styles.sparkFallbackCol}>
                          <View
                            style={[
                              styles.sparkFallbackBar,
                              {
                                height: `${Math.max(25, point * 18)}%`,
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Reanimated.View>

              <Reanimated.View entering={FadeInDown.delay(170).duration(460)} style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Journal History</Text>
                  <Pressable onPress={() => router.push("/journal")}>
                    <Text style={styles.sectionLink}>View all</Text>
                  </Pressable>
                </View>
                {(profile?.journalHistory ?? []).length === 0 ? (
                  <Text style={styles.emptyHistoryText}>No journal entries yet.</Text>
                ) : (
                  (profile?.journalHistory ?? []).map((entry) => (
                    <View key={entry.id} style={styles.historyRow}>
                      <View style={styles.historyMain}>
                        <Text style={styles.historyPreview} numberOfLines={1}>{entry.preview}</Text>
                        <Text style={styles.historyDate}>{entry.dateLabel}</Text>
                      </View>
                      <View style={styles.moodPill}>
                        <Text style={styles.moodPillText}>{entry.moodLabel}</Text>
                      </View>
                    </View>
                  ))
                )}
              </Reanimated.View>

              <Reanimated.View entering={FadeInDown.delay(200).duration(460)} style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Ami Memory</Text>
                  <Pressable
                    onPress={() => clearMemoryMutation.mutate()}
                    disabled={clearMemoryMutation.isPending || (profile?.memories.length ?? 0) === 0}
                  >
                    <Text style={styles.sectionLink}>
                      {clearMemoryMutation.isPending ? "Clearing..." : "Clear all"}
                    </Text>
                  </Pressable>
                </View>
                {(profile?.memories ?? []).length === 0 ? (
                  <Text style={styles.emptyHistoryText}>No memories saved yet.</Text>
                ) : (
                  (profile?.memories ?? []).map((memory) => (
                    <View key={memory.id} style={styles.memoryRow}>
                      <Text style={styles.memoryFact} numberOfLines={2}>{memory.fact}</Text>
                      <Pressable
                        onPress={() => forgetMemoryMutation.mutate(memory.id)}
                        disabled={forgetMemoryMutation.isPending}
                        style={styles.memoryForgetBtn}
                      >
                        <Text style={styles.memoryForgetText}>Forget</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </Reanimated.View>

              <Reanimated.View entering={FadeInDown.delay(220).duration(460)} style={styles.sectionCard}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Companion name</Text>
                  <Pressable onPress={handleOpenCompanionEdit}>
                    <Text style={styles.sectionLink}>Edit</Text>
                  </Pressable>
                </View>
                <Text style={styles.emptyHistoryText}>
                  Current name: {profile?.companionName || "Companion"}
                </Text>
              </Reanimated.View>
            </>
          )}

          <Pressable onPress={() => setIsLogoutConfirmOpen(true)} style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutPressed]}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </ScrollView>

        <Modal visible={isEditOpen} transparent animationType="fade" onRequestClose={() => setIsEditOpen(false)}>
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
              />
              {nameError ? <Text style={styles.nameErrorText}>{nameError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setIsEditOpen(false)} style={styles.modalGhostBtn} disabled={saveNameMutation.isPending}>
                  <Text style={styles.modalGhostText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveName} style={[styles.modalSaveBtn, saveNameMutation.isPending && styles.buttonDisabled]} disabled={saveNameMutation.isPending}>
                  <Text style={styles.modalSaveText}>{saveNameMutation.isPending ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isLogoutConfirmOpen} transparent animationType="fade" onRequestClose={() => setIsLogoutConfirmOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.logoutModalCard}>
              <Text style={styles.logoutModalTitle}>Sign out</Text>
              <Text style={styles.logoutConfirmText}>Are you sure you want to sign out?</Text>
              <View style={styles.logoutActions}>
                <Pressable onPress={() => setIsLogoutConfirmOpen(false)} style={styles.logoutCancelBtn}>
                  <Text style={styles.logoutCancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleLogout} style={styles.logoutPrimaryBtn}>
                  <Text style={styles.logoutPrimaryText}>Sign out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isCompanionEditOpen} transparent animationType="fade" onRequestClose={() => setIsCompanionEditOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Name your companion</Text>
              <TextInput
                style={styles.nameInput}
                value={companionNameInput}
                onChangeText={(value) => {
                  setCompanionNameInput(value);
                  if (companionNameError) setCompanionNameError("");
                }}
                placeholder="Companion name"
                placeholderTextColor={AppTheme.colors.textMuted}
              />
              {companionNameError ? <Text style={styles.nameErrorText}>{companionNameError}</Text> : null}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setIsCompanionEditOpen(false)}
                  style={styles.modalGhostBtn}
                  disabled={saveCompanionNameMutation.isPending}
                >
                  <Text style={styles.modalGhostText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveCompanionName}
                  style={[styles.modalSaveBtn, saveCompanionNameMutation.isPending && styles.buttonDisabled]}
                  disabled={saveCompanionNameMutation.isPending}
                >
                  <Text style={styles.modalSaveText}>{saveCompanionNameMutation.isPending ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.colors.background },
  content: { paddingHorizontal: AppTheme.space.xl, paddingTop: 16, paddingBottom: 130, gap: 12 },
  hero: { alignItems: "center", marginBottom: 10 },
  avatarFrame: { width: 110, height: 110, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarRing: { position: "absolute", width: 110, height: 110, borderRadius: 55, padding: 2 },
  avatarRingFill: { flex: 1, borderRadius: 55 },
  avatar: { width: 98, height: 98, borderRadius: 49, borderWidth: 2, borderColor: "rgba(255,255,255,0.12)" },
  name: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.serifDisplay, fontSize: 40, lineHeight: 44 },
  nameRow: { marginTop: 4, marginBottom: 2, flexDirection: "row", alignItems: "center", gap: 10 },
  email: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyRegular, fontSize: 14 },
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
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%",
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 124,
  },
  statValue: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.statItalic, fontSize: 34, lineHeight: 40 },
  statLabel: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyBold, fontSize: 13, marginTop: 2 },
  statContext: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyRegular, fontSize: 11, marginTop: 4, textAlign: "center" },
  sectionCard: {
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    padding: 14,
  },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyBold, fontSize: 14 },
  sectionLink: { color: AppTheme.colors.accentPrimary, fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  sparklineWrap: { alignItems: "center", justifyContent: "center", height: 64 },
  sparkFallbackRow: {
    width: 240,
    height: 60,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sparkFallbackCol: {
    width: 22,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  sparkFallbackBar: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "#5ECFB1",
  },
  emptyHistoryText: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyRegular, fontSize: 13 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  historyMain: { flex: 1, marginRight: 12 },
  historyPreview: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyRegular, fontSize: 13 },
  historyDate: { marginTop: 2, color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyRegular, fontSize: 11 },
  moodPill: { borderRadius: 999, backgroundColor: "rgba(94,207,177,0.16)", paddingHorizontal: 10, paddingVertical: 5 },
  moodPillText: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyMedium, fontSize: 11 },
  memoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  memoryFact: {
    flex: 1,
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  memoryForgetBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  memoryForgetText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
  },
  signOutBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: AppTheme.radius.lg,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  signOutPressed: { backgroundColor: "rgba(255,255,255,0.06)" },
  signOutText: { color: "#C7D0DE", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 15 },
  skeletonCard: {
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
    padding: 14,
    marginBottom: 10,
  },
  skeletonLine: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", paddingHorizontal: AppTheme.space.xl },
  modalCard: { borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.colors.surfaceBorder, backgroundColor: AppTheme.colors.surface, padding: AppTheme.space.lg },
  modalTitle: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyBold, fontSize: 18, marginBottom: 10 },
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
  nameErrorText: { marginTop: 8, color: AppTheme.colors.danger, fontFamily: AppTheme.fonts.bodyRegular, fontSize: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  modalGhostBtn: { borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.surfaceBorder, paddingHorizontal: 14, paddingVertical: 10 },
  modalGhostText: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyMedium },
  modalSaveBtn: { borderRadius: AppTheme.radius.md, backgroundColor: AppTheme.colors.accentPrimary, paddingHorizontal: 18, paddingVertical: 10 },
  modalSaveText: { color: AppTheme.colors.background, fontFamily: AppTheme.fonts.bodyBold },
  buttonDisabled: { opacity: 0.45 },
  retryBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,145,74,0.55)",
    backgroundColor: "rgba(200,145,74,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: { color: "#E8C898", fontFamily: AppTheme.fonts.bodyBold, fontSize: 12 },
  logoutModalCard: {
    borderRadius: 20,
    backgroundColor: AppTheme.colors.surface,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    padding: 28,
  },
  logoutModalTitle: { color: "#F5F7FA", fontFamily: AppTheme.fonts.bodyBold, fontSize: 18, marginBottom: 6 },
  logoutConfirmText: { color: "#6B7280", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  logoutActions: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  logoutPrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  logoutPrimaryText: { color: "#C7D0DE", fontFamily: AppTheme.fonts.bodyBold, fontSize: 15 },
  logoutCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
  },
  logoutCancelText: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyMedium, fontSize: 15 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
