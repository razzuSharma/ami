import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppTheme, design, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { moodEmojiFromValue, moodLabelFromValue } from "../../helper/mood";
import { getProfileCache, setProfileCache } from "../../helper/profileCache";
import { invalidateUserQueries, userQueryKeys } from "../../helper/queryCache";
import { supabase } from "../../helper/supabaseClient";
import { ensureUserProfile } from "../../helper/userProfile";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { useToast } from "../../../shared/components/Toast";

const MOOD_OPTIONS = [
  { id: "anxious", label: "Anxious", value: 1, emoji: "😰" },
  { id: "tired", label: "Tired", value: 2, emoji: "😔" },
  { id: "calm", label: "Calm", value: 3, emoji: "😌" },
  { id: "good", label: "Good", value: 4, emoji: "🙂" },
  { id: "excited", label: "Excited", value: 5, emoji: "🤩" },
] as const;

type CheckinPoint = {
  id: string;
  date: string;
  mood: number;
  notes: string | null;
};

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeStreak(points: Pick<CheckinPoint, "date">[]) {
  if (points.length === 0) return 0;
  const dateSet = new Set(points.map((point) => point.date.slice(0, 10)));
  let cursor = new Date();
  let streak = 0;
  if (!dateSet.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dateSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildMoodPreview(points: Pick<CheckinPoint, "date" | "mood">[]) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const start = toDateKey(sevenDaysAgo);
  const validMoods = points.filter((point) => point.date >= start).map((point) => point.mood);
  if (validMoods.length === 0) return "No recent check-ins";
  const avg = validMoods.reduce((sum, val) => sum + val, 0) / validMoods.length;
  const tone = moodLabelFromValue(avg);
  return `${tone} avg · ${validMoods.length}/7 days`;
}

function skeletonLine(width: `${number}%`) {
  return (
    <View
      style={{
        height: 10,
        width,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.14)",
      }}
    />
  );
}

export default function DailyCheckin() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const glowPulse = useSharedValue(0);

  const today = toDateKey(new Date());
  const userId = user?.id ?? "anonymous";
  const keys = user?.id ? userQueryKeys(user.id) : null;

  const todayQuery = useQuery<CheckinPoint | null>({
    queryKey: queryKeys.checkInToday(userId, today),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("id,mood,notes,date")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as CheckinPoint | null;
    },
  });

  const recentQuery = useQuery<CheckinPoint[]>({
    queryKey: queryKeys.checkInsRecent(userId),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user?.id) return [];
      const from = new Date();
      from.setDate(from.getDate() - 60);
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("id,date,mood,notes")
        .eq("user_id", user.id)
        .gte("date", toDateKey(from))
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as CheckinPoint[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sign in required");
      await ensureUserProfile(user);
      const moodValue = MOOD_OPTIONS.find((option) => option.id === mood)?.value;
      if (!moodValue) throw new Error("Select a mood");

      const existingId = todayQuery.data?.id ?? null;
      if (existingId) {
        const { error } = await supabase
          .from("daily_checkins")
          .update({
            mood: moodValue,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId)
          .eq("user_id", user.id);
        if (error) throw new Error(error.message);
        return existingId;
      }

      const { data, error } = await supabase
        .from("daily_checkins")
        .insert({
          user_id: user.id,
          date: today,
          mood: moodValue,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    onSuccess: async () => {
      if (!user?.id || !keys) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.checkInToday(user.id, today) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.checkInsRecent(user.id) }),
      ]);
      await invalidateUserQueries(queryClient, user.id, "none");
      const trends = queryClient.getQueryData<{ date: string; mood: number }[]>(keys.moodTrends) ?? [];
      const cache = getProfileCache(user.id);
      if (cache) {
        setProfileCache({
          ...cache,
          stats: {
            ...cache.stats,
            streak: computeStreak(trends),
            checkins: trends.length,
          },
          moodPreview: buildMoodPreview(trends),
          loadedAt: Date.now(),
        });
      }
      setSubmitted(true);
    },
    onError: (error: Error) => {
      const message =
        error.message === "Select a mood"
          ? "How are you feeling today?"
          : "Could not save your check-in.";
      show(message);
      Alert.alert("Error", message);
    },
  });

  useEffect(() => {
    const todayRow = todayQuery.data;
    if (!todayRow) return;
    const matched = MOOD_OPTIONS.find((option) => option.value === todayRow.mood);
    if (matched) setMood(matched.id);
    setNotes(todayRow.notes ?? "");
    setSubmitted(true);
  }, [todayQuery.data]);

  const loadingSavedState = recentQuery.isLoading || todayQuery.isLoading;
  const hasQueryError = todayQuery.isError || recentQuery.isError;

  const weekData = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const map = new Map((recentQuery.data ?? []).map((item) => [item.date.slice(0, 10), item]));
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);
      const row = map.get(key);
      return {
        key,
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        mood: row?.mood ?? null,
        isToday: key === today,
      };
    });
  }, [recentQuery.data, today]);

  const lastSevenCheckins = useMemo(() => (recentQuery.data ?? []).slice(0, 7), [recentQuery.data]);

  const topMoods = useMemo(() => {
    const counts = new Map<string, number>();
    for (const checkin of lastSevenCheckins) {
      const label = moodLabelFromValue(checkin.mood);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([label, count]) => ({ label, count, emoji: moodEmojiFromValue(label) }));
  }, [lastSevenCheckins]);

  const lastMood = lastSevenCheckins[0] ? moodLabelFromValue(lastSevenCheckins[0].mood) : null;
  const streak = useMemo(() => computeStreak(recentQuery.data ?? []), [recentQuery.data]);

  useEffect(() => {
    if (streak >= 3) {
      glowPulse.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
      return;
    }
    glowPulse.value = withTiming(0, { duration: 200 });
  }, [glowPulse, streak]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.15 + glowPulse.value * 0.3,
  }));

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Daily check-in</Text>
            <Text style={styles.date}>{dateStr}</Text>

            <Animated.View entering={FadeInDown.duration(400)} style={styles.panel}>
              {hasQueryError ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.mutedText}>Couldn&apos;t load your check-in data.</Text>
                  <Pressable
                    onPress={() => {
                      void Promise.all([todayQuery.refetch(), recentQuery.refetch()]);
                    }}
                    style={styles.ctaButton}
                  >
                    <Text style={styles.ctaText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              {submitted || Boolean(todayQuery.data) ? (
                <>
                  <Text style={styles.sectionTitle}>Saved for today</Text>
                  <Text style={styles.value}>{MOOD_OPTIONS.find((m) => m.id === mood)?.label ?? moodLabelFromValue(todayQuery.data?.mood ?? 3)}</Text>
                  {(notes.trim() || todayQuery.data?.notes) ? (
                    <Text style={styles.savedNote}>{notes.trim() || todayQuery.data?.notes}</Text>
                  ) : null}

                  {loadingSavedState ? (
                    <View style={styles.sectionCard}>
                      {skeletonLine("40%")}
                      <View style={{ marginTop: 8 }}>{skeletonLine("90%")}</View>
                      <View style={{ marginTop: 8 }}>{skeletonLine("70%")}</View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.sectionCard}>
                        <Text style={styles.cardTitle}>Your week at a glance</Text>
                        <View style={styles.weekRow}>
                          {weekData.map((day) => (
                            <View key={day.key} style={[styles.dayPill, day.isToday && styles.todayPill]}>
                              <Text style={styles.dayText}>{day.day}</Text>
                              <Text style={styles.dayMood}>{day.mood ? moodEmojiFromValue(day.mood) : "—"}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={styles.sectionCard}>
                        <Text style={styles.cardTitle}>How you&apos;ve been feeling</Text>
                        <View style={styles.gridTwo}>
                          {topMoods.length === 0 ? (
                            <Text style={styles.mutedText}>No recent mood pattern yet.</Text>
                          ) : (
                            topMoods.map((item) => (
                              <View key={item.label} style={styles.moodStat}>
                                <Text style={styles.moodStatEmoji}>{item.emoji}</Text>
                                <Text style={styles.moodStatLabel}>{item.label}</Text>
                                <Text style={styles.moodStatSub}>{item.count} times</Text>
                              </View>
                            ))
                          )}
                        </View>
                      </View>

                      <View style={styles.sectionCard}>
                        <Text style={styles.cardTitle}>Reflection prompt</Text>
                        {lastMood === "Anxious" || lastMood === "Tired" ? (
                          <>
                            <Text style={styles.promptText}>Want to talk to Ami about it?</Text>
                            <Pressable onPress={() => router.replace("/(tabs)/companion")} style={styles.ctaButton}>
                              <Text style={styles.ctaText}>Open Companion</Text>
                            </Pressable>
                          </>
                        ) : (
                          <>
                            <Text style={styles.promptText}>Capture this feeling in your journal.</Text>
                            <Pressable onPress={() => router.push("/journal")} style={styles.ctaButton}>
                              <Text style={styles.ctaText}>Write in Journal</Text>
                            </Pressable>
                          </>
                        )}
                      </View>

                      <View style={[styles.sectionCard, styles.streakCard]}>
                        {streak >= 3 ? <Animated.View style={[styles.streakGlow, glowStyle]} /> : null}
                        <Text style={styles.streakLabel}>🔥 Current streak</Text>
                        <Text style={styles.streakValue}>{streak} days</Text>
                      </View>
                    </>
                  )}

                  <Pressable onPress={() => setSubmitted(false)} style={[styles.button, styles.ghostButton]}>
                    <Text style={styles.ghostText}>Edit check-in</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>How do you feel right now?</Text>
                  <View style={styles.moodRow}>
                    {MOOD_OPTIONS.map((opt) => (
                      <Pressable key={opt.id} onPress={() => setMood(opt.id)} style={[styles.moodChip, mood === opt.id && styles.moodChipActive]}>
                        <Text style={[styles.moodLabel, mood === opt.id && styles.moodLabelActive]}>{opt.emoji} {opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.notesLabel}>Notes</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="One sentence about your day..."
                    placeholderTextColor={design.colors.mutedInk}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    textAlignVertical="top"
                  />

                  <Pressable
                    onPress={() => saveMutation.mutate()}
                    style={[styles.button, saveMutation.isPending && styles.buttonDisabled]}
                    disabled={saveMutation.isPending}
                  >
                    <Text style={styles.buttonText}>{saveMutation.isPending ? "Saving..." : "Save check-in"}</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: design.space.xl, paddingTop: 16, paddingBottom: 120 },
  title: { color: design.colors.textPrimary, fontSize: 30, fontWeight: "700" },
  date: { color: design.colors.textSecondary, fontSize: 14, marginTop: 5, marginBottom: design.space.lg },
  panel: {
    borderRadius: design.radius.xl,
    backgroundColor: "rgba(15,32,64,0.78)",
    borderWidth: 1,
    borderColor: design.colors.border,
    padding: design.space.lg,
    gap: 12,
  },
  sectionTitle: { color: design.colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  moodRow: { gap: 10, marginBottom: 4 },
  moodChip: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 13,
    alignItems: "center",
  },
  moodChipActive: { backgroundColor: design.colors.accentSoft, borderColor: "rgba(94,207,177,0.45)" },
  moodLabel: { color: design.colors.textSecondary, fontWeight: "600", fontSize: 13 },
  moodLabelActive: { color: design.colors.textPrimary },
  notesLabel: {
    color: design.colors.textSecondary,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  input: {
    minHeight: 100,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: design.space.md,
    color: design.colors.textPrimary,
    fontSize: 15,
  },
  button: {
    borderRadius: design.radius.lg,
    backgroundColor: "#c8914a",
    alignItems: "center",
    paddingVertical: 14,
  },
  buttonText: { color: "#1b140b", fontSize: 16, fontWeight: "700" },
  buttonDisabled: { opacity: 0.55 },
  value: { color: "#e8c88f", fontWeight: "700", fontSize: 22, marginBottom: 4 },
  savedNote: { color: design.colors.textSecondary, fontSize: 15, lineHeight: 21 },
  ghostButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: design.colors.border, marginTop: 6 },
  ghostText: { color: design.colors.textSecondary, fontSize: 15, fontWeight: "700" },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    overflow: "hidden",
  },
  cardTitle: {
    color: design.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 13,
    marginBottom: 10,
  },
  weekRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  dayPill: {
    flex: 1,
    minWidth: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    alignItems: "center",
    paddingVertical: 8,
    gap: 3,
  },
  todayPill: {
    borderColor: "rgba(94,207,177,0.7)",
    backgroundColor: "rgba(94,207,177,0.14)",
    shadowColor: "#5ECFB1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  dayText: { color: design.colors.textSecondary, fontSize: 11, fontWeight: "600" },
  dayMood: { color: design.colors.textPrimary, fontSize: 15 },
  gridTwo: { flexDirection: "row", gap: 10 },
  moodStat: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    alignItems: "center",
  },
  moodStatEmoji: { fontSize: 22, marginBottom: 4 },
  moodStatLabel: { color: design.colors.textPrimary, fontFamily: AppTheme.fonts.bodyBold, fontSize: 13 },
  moodStatSub: { color: design.colors.textSecondary, fontSize: 11, marginTop: 2 },
  mutedText: { color: design.colors.textSecondary, fontSize: 12 },
  promptText: { color: design.colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 10 },
  ctaButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,145,74,0.6)",
    backgroundColor: "rgba(200,145,74,0.16)",
    alignItems: "center",
    paddingVertical: 10,
  },
  ctaText: { color: "#e8c88f", fontFamily: AppTheme.fonts.bodyBold, fontSize: 13 },
  streakCard: { alignItems: "center", justifyContent: "center" },
  streakGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(200,145,74,0.22)",
  },
  streakLabel: { color: design.colors.textSecondary, fontSize: 12, marginBottom: 4 },
  streakValue: { color: "#f1d6ad", fontFamily: AppTheme.fonts.serifDisplay, fontSize: 30 },
});
