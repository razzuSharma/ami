import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
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
import { AppTheme } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { getJournalReflection } from "../../helper/companion";
import { getProfileCache, setProfileCache } from "../../helper/profileCache";
import { invalidateUserQueries, userQueryKeys } from "../../helper/queryCache";
import { supabase } from "../../helper/supabaseClient";
import { ensureUserProfile } from "../../helper/userProfile";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { useToast } from "../../../shared/components/Toast";

type EntryMood = "CALM" | "HAPPY" | "ANXIOUS" | "TIRED";

type Entry = {
  id: string;
  title: string;
  preview: string;
  rawContent: string;
  dateISO: string;
  dateLabel: string;
  readLabel: string;
  mood: EntryMood;
  aiReflection: string | null;
};

type InsertedEntryRow = {
  id: string;
  content: string | null;
  created_at: string;
  ai_reflection: string | null;
};

type DraftMood = "calm" | "happy" | "anxious" | null;

function inferMood(content: string, id: string): EntryMood {
  const text = content.toLowerCase();
  if (/(calm|breathe|peace|still|quiet|meditat)/.test(text)) return "CALM";
  if (/(happy|good|great|win|grateful|excited)/.test(text)) return "HAPPY";
  if (/(anxious|stress|panic|worry|overwhelm|sad|down)/.test(text)) return "ANXIOUS";
  if (/(tired|drain|exhaust|fatigue|sleep)/.test(text)) return "TIRED";
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const moods: EntryMood[] = ["CALM", "HAPPY", "ANXIOUS", "TIRED"];
  return moods[seed % moods.length];
}

function splitEntry(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  const title = compact.slice(0, 46) || "Untitled entry";
  return { title, compact };
}

function buildPreview(content: string, title: string, dateISO: string) {
  if (content && content !== title) {
    return `${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`;
  }
  return `Written ${new Date(dateISO).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

function buildReadLabel(content: string) {
  const wordCount = content.split(" ").filter(Boolean).length;
  if (wordCount < 10) return "Quick thought";
  if (wordCount < 50) return "Short entry";
  if (wordCount < 150) return "Medium entry";
  return "Long entry";
}

function monthHeader(dateISO: string) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function FrostedCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={style}>{children}</View>;
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2].map((idx) => (
        <View key={idx} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, { width: "40%" }]} />
          <View style={[styles.skeletonLine, { width: "92%", marginTop: 10 }]} />
          <View style={[styles.skeletonLine, { width: "78%", marginTop: 8 }]} />
        </View>
      ))}
    </View>
  );
}

export default function JournalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [modalVisible, setModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState<DraftMood>(null);
  const [draftReflection, setDraftReflection] = useState<string | null>(null);
  const [lastReflectedText, setLastReflectedText] = useState("");
  const optimisticRef = useRef<{ previousEntries: Entry[]; optimisticId: string } | null>(null);
  const reflectionPulse = useSharedValue(0);
  const userName = user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "friend";
  const userId = user?.id ?? "anonymous";

  const entriesQuery = useQuery({
    queryKey: queryKeys.journal(userId),
    enabled: Boolean(user?.id),
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id,content,created_at,ai_reflection")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((item) => {
        const content = item.content ?? "";
        const details = splitEntry(content);
        return {
          id: item.id,
          title: details.title,
          preview: buildPreview(details.compact, details.title, item.created_at),
          rawContent: details.compact,
          readLabel: buildReadLabel(details.compact),
          mood: inferMood(content, item.id),
          dateISO: item.created_at,
          dateLabel: new Date(item.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          aiReflection: typeof item.ai_reflection === "string" ? item.ai_reflection : null,
        } as Entry;
      });
    },
  });

  const addEntryMutation = useMutation<InsertedEntryRow>({
    mutationFn: async () => {
      if (!user?.id || !newEntry.trim()) {
        throw new Error("Entry is empty");
      }
      await ensureUserProfile(user);

      const content = newEntry.trim();
      const moodValue = selectedMood ? selectedMood.toUpperCase() : null;
      const payload = {
        user_id: user.id,
        title: content.split("\n")[0].slice(0, 80) || null,
        content,
        mood: moodValue,
        ai_reflection: draftReflection || null,
      };

      const firstInsert = await supabase
        .from("journal_entries")
        .insert(payload)
        .select("id,content,created_at,ai_reflection")
        .single();
      if (!firstInsert.error && firstInsert.data) return firstInsert.data as InsertedEntryRow;

      const retryInsert = await supabase
        .from("journal_entries")
        .insert({
          user_id: user.id,
          title: payload.title,
          content: payload.content,
          ai_reflection: payload.ai_reflection,
        })
        .select("id,content,created_at,ai_reflection")
        .single();
      if (retryInsert.error) throw new Error(retryInsert.error.message);
      return retryInsert.data as InsertedEntryRow;
    },
    onMutate: async () => {
      if (!user?.id) return null;
      const keys = userQueryKeys(user.id);
      const previousEntries = queryClient.getQueryData<Entry[]>(keys.journalEntries) ?? [];
      const optimisticId = `optimistic-${Date.now()}`;
      const details = splitEntry(newEntry.trim());
      const optimistic: Entry = {
        id: optimisticId,
        title: details.title,
        preview: buildPreview(details.compact, details.title, new Date().toISOString()),
        rawContent: details.compact,
        readLabel: buildReadLabel(details.compact),
        mood: selectedMood === "calm" ? "CALM" : selectedMood === "happy" ? "HAPPY" : selectedMood === "anxious" ? "ANXIOUS" : inferMood(newEntry, optimisticId),
        dateISO: new Date().toISOString(),
        dateLabel: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        aiReflection: draftReflection || null,
      };
      queryClient.setQueryData<Entry[]>(keys.journalEntries, [optimistic, ...previousEntries]);
      optimisticRef.current = { previousEntries, optimisticId };
      return null;
    },
    onSuccess: async (inserted) => {
      if (!user?.id) return;
      const keys = userQueryKeys(user.id);
      const details = splitEntry(inserted.content ?? "");
      const persisted: Entry = {
        id: inserted.id,
        title: details.title,
        preview: buildPreview(details.compact, details.title, inserted.created_at),
        rawContent: details.compact,
        readLabel: buildReadLabel(details.compact),
        mood: inferMood(inserted.content ?? "", inserted.id),
        dateISO: inserted.created_at,
        dateLabel: new Date(inserted.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        aiReflection: typeof inserted.ai_reflection === "string" ? inserted.ai_reflection : null,
      };
      queryClient.setQueryData<Entry[]>(keys.journalEntries, (current = []) =>
        current.map((entry) => (entry.id === optimisticRef.current?.optimisticId ? persisted : entry)),
      );

      const cache = getProfileCache(user.id);
      if (cache) {
        setProfileCache({
          ...cache,
          stats: { ...cache.stats, journal: cache.stats.journal + 1 },
          journalPreview: `Last entry · ${new Date(inserted.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}`,
          loadedAt: Date.now(),
        });
      }
      setNewEntry("");
      setSelectedMood(null);
      setDraftReflection(null);
      setLastReflectedText("");
      setModalVisible(false);
      await invalidateUserQueries(queryClient, user.id, "none");
    },
    onError: () => {
      if (!user?.id || !optimisticRef.current) return;
      const keys = userQueryKeys(user.id);
      queryClient.setQueryData<Entry[]>(keys.journalEntries, optimisticRef.current.previousEntries ?? []);
      show("Could not save journal entry.");
    },
  });

  const reflectionMutation = useMutation({
    mutationFn: async () => {
      return getJournalReflection({
        entryText: newEntry.trim(),
        userName,
      });
    },
    onSuccess: (text) => {
      setDraftReflection(text);
      setLastReflectedText(newEntry.trim());
    },
    onError: () => {
      show("Could not generate reflection right now.");
    },
  });

  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);
  const loading = entriesQuery.isLoading;
  const draftWordCount = useMemo(() => {
    const compact = newEntry.trim();
    if (!compact) return 0;
    return compact.split(/\s+/).filter(Boolean).length;
  }, [newEntry]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q)
        || entry.preview.toLowerCase().includes(q)
        || entry.mood.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const canReflect = draftWordCount >= 20;
  const reflectionStale = lastReflectedText !== newEntry.trim();

  useEffect(() => {
    if (reflectionMutation.isPending) {
      reflectionPulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return;
    }
    reflectionPulse.value = withTiming(0, { duration: 180 });
  }, [reflectionMutation.isPending, reflectionPulse]);

  const reflectionPulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + reflectionPulse.value * 0.45,
  }));

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0A1628", "#0B1A31", "#0A1628"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Pressable onPress={() => router.replace("/(tabs)/profile")} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={16} color="#7A8FA6" />
              </Pressable>
              <Text style={styles.pageTitle}>Journal</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{entries.length} {entries.length === 1 ? "entry" : "entries"}</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color="#8B94A3" style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search entries..."
                placeholderTextColor="#8B94A3"
                style={styles.searchInput}
              />
            </View>

            {loading ? (
              <LoadingSkeleton />
            ) : entriesQuery.isError ? (
              <FrostedCard style={styles.emptyWrap}>
                <Ionicons name="warning-outline" size={28} color="#E8C898" />
                <Text style={styles.emptyTitle}>Couldn&apos;t load entries</Text>
                <Pressable onPress={() => entriesQuery.refetch()} style={styles.reflectBtn}>
                  <Text style={styles.reflectBtnText}>Retry</Text>
                </Pressable>
              </FrostedCard>
            ) : filteredEntries.length === 0 ? (
              <FrostedCard style={styles.emptyWrap}>
                <Ionicons name="book-outline" size={30} color="#5ECFB1" />
                <Text style={styles.emptyTitle}>Start your first reflection</Text>
                <Text style={styles.emptyBody}>Try this: &quot;What feeling has followed me today, and what might it need?&quot;</Text>
              </FrostedCard>
            ) : (
              <View style={styles.timelineWrap}>
                <Text style={styles.monthHeading}>{monthHeader(filteredEntries[0].dateISO)}</Text>
                {filteredEntries.map((entry) => (
                  <FrostedCard key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryTopRow}>
                      <Text style={styles.entryDateText}>{entry.dateLabel}</Text>
                      <Text style={styles.entryMoodText}>{entry.mood}</Text>
                    </View>
                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryPreview}>{entry.preview}</Text>

                    {entry.aiReflection ? (
                      <Animated.View entering={FadeInDown.duration(260)} style={styles.reflectionCard}>
                        <View style={styles.reflectionHead}>
                          <Text style={styles.reflectionLabel}>✦ Ami&apos;s reflection</Text>
                        </View>
                        <Text style={styles.reflectionText}>{entry.aiReflection}</Text>
                      </Animated.View>
                    ) : null}

                    <View style={styles.entryDivider} />
                    <View style={styles.entryFooter}>
                      <Text style={styles.entryWords}>{entry.readLabel}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#8B94A3" />
                    </View>
                  </FrostedCard>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.bottomNav}>
          <Pressable onPress={() => router.replace("/(tabs)")} style={styles.navItem}>
            <Ionicons name="home-outline" size={20} color="#6B7280" />
            <Text style={styles.navText}>Home</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/(tabs)/checkins")} style={styles.navItem}>
            <MaterialIcons name="check-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.navText}>Check-in</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/(tabs)/profile")} style={styles.navItem}>
            <Ionicons name="person" size={20} color="#5ECFB1" />
            <Text style={styles.navTextActive}>Profile</Text>
          </Pressable>
          <View style={styles.fabShell}>
            <Pressable onPress={() => setModalVisible(true)} style={styles.fabButton}>
              <Ionicons name="add" size={24} color="#0A1628" />
            </Pressable>
          </View>
        </View>

        <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={() => setModalVisible(false)}>
          <SafeAreaView style={styles.editorScreen}>
            <View style={styles.editorHeader}>
              <Pressable onPress={() => setModalVisible(false)} style={({ pressed }) => [styles.editorCloseBtn, pressed && styles.pressed]}>
                <Ionicons name="close" size={20} color="#F0EDE8" />
              </Pressable>
              <Pressable
                onPress={() => addEntryMutation.mutate()}
                style={({ pressed }) => [styles.editorSaveBtn, (!newEntry.trim() || addEntryMutation.isPending) && styles.editorSaveBtnDisabled, pressed && styles.pressed]}
                disabled={!newEntry.trim() || addEntryMutation.isPending}
              >
                <Text style={styles.editorSaveText}>{addEntryMutation.isPending ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.editorInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#8B94A3"
              value={newEntry}
              onChangeText={(value) => {
                setNewEntry(value);
                if (draftReflection && value.trim() !== lastReflectedText) {
                  setDraftReflection(null);
                }
              }}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.editorBottomRow}>
              <Text style={styles.editorWordCount}>{draftWordCount} words</Text>
            </View>

            {canReflect ? (
              <Pressable
                onPress={() => reflectionMutation.mutate()}
                disabled={reflectionMutation.isPending || (!reflectionStale && Boolean(draftReflection))}
                style={({ pressed }) => [
                  styles.reflectBtn,
                  (reflectionMutation.isPending || (!reflectionStale && Boolean(draftReflection)) || pressed) && styles.pressed,
                ]}
              >
                <Text style={styles.reflectBtnText}>✦ Reflect with Ami</Text>
              </Pressable>
            ) : null}

            {reflectionMutation.isPending ? (
              <Animated.View style={[styles.reflectLoading, reflectionPulseStyle]}>
                <Text style={styles.reflectLoadingText}>Ami is reading...</Text>
              </Animated.View>
            ) : null}

            {draftReflection ? (
              <Animated.View entering={FadeInDown.duration(260)} style={styles.reflectionCard}>
                <View style={styles.reflectionHead}>
                  <Text style={styles.reflectionLabel}>✦ Ami&apos;s reflection</Text>
                </View>
                <Text style={styles.reflectionText}>{draftReflection}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.moodRow}>
              <Pressable onPress={() => setSelectedMood("calm")} style={[styles.moodBtn, selectedMood === "calm" && styles.moodBtnActive]}>
                <Text style={styles.moodBtnText}>😌 Calm</Text>
              </Pressable>
              <Pressable onPress={() => setSelectedMood("happy")} style={[styles.moodBtn, selectedMood === "happy" && styles.moodBtnActive]}>
                <Text style={styles.moodBtnText}>😊 Happy</Text>
              </Pressable>
              <Pressable onPress={() => setSelectedMood("anxious")} style={[styles.moodBtn, selectedMood === "anxious" && styles.moodBtnActive]}>
                <Text style={styles.moodBtnText}>😓 Anxious</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  content: { paddingTop: 14, paddingBottom: 170, gap: 22 },
  backBtn: {
    alignSelf: "center",
    marginRight: 2,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(122,143,166,0.12)",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -2 },
  pageTitle: { color: "#F0EDE8", fontFamily: AppTheme.fonts.serifDisplay, fontSize: 36, lineHeight: 40 },
  countBadge: { borderRadius: 999, backgroundColor: "rgba(122,143,166,0.2)", paddingHorizontal: 10, paddingVertical: 6 },
  countBadgeText: { color: "#B8C5D6", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  searchWrap: {
    borderRadius: 15,
    backgroundColor: "rgba(20,46,88,0.75)",
    paddingHorizontal: 14,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: "#F0EDE8", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 14 },
  skeletonWrap: { gap: 10, marginTop: 10 },
  skeletonCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(103,136,182,0.24)",
    backgroundColor: "rgba(19,43,79,0.9)",
    padding: 14,
  },
  skeletonLine: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" },
  emptyWrap: {
    marginTop: 40,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(103,136,182,0.24)",
    backgroundColor: "rgba(19,43,79,0.9)",
    padding: 18,
    gap: 8,
    alignItems: "center",
  },
  emptyTitle: { color: "#F0EDE8", fontFamily: AppTheme.fonts.bodyBold, fontSize: 20, textAlign: "center" },
  emptyBody: { color: "#AFC0D7", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 14, textAlign: "center", lineHeight: 22 },
  timelineWrap: { gap: 14 },
  monthHeading: {
    color: "#7A8FA6",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  entryCard: {
    borderRadius: 18,
    backgroundColor: "rgba(19,43,79,0.9)",
    borderWidth: 1,
    borderColor: "rgba(103,136,182,0.24)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 9,
  },
  entryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryDateText: { color: "#7A8FA6", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  entryMoodText: { color: "#5ECFB1", fontFamily: AppTheme.fonts.bodyBold, fontSize: 11, letterSpacing: 0.5 },
  entryTitle: { color: "#F0EDE8", fontFamily: AppTheme.fonts.serifDisplay, fontSize: 20, lineHeight: 24 },
  entryPreview: { color: "#AFC0D7", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 13, lineHeight: 21 },
  reflectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderLeftWidth: 3,
    borderLeftColor: "#c8914a",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
    gap: 7,
  },
  reflectionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  reflectionLabel: { color: "#E8C898", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12, letterSpacing: 0.4 },
  reflectionText: { color: "#D8E2F1", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 14, lineHeight: 22 },
  entryDivider: { height: 1, backgroundColor: "rgba(120,149,186,0.2)" },
  entryFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryWords: {
    fontSize: 11,
    color: "rgba(180,195,215,0.45)",
    fontStyle: "italic",
  },
  bottomNav: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(98,126,162,0.3)",
    backgroundColor: "rgba(7,24,48,0.96)",
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: { alignItems: "center", gap: 3, width: 80 },
  navText: { color: "#7A8FA6", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 11 },
  navTextActive: { color: "#5ECFB1", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 11 },
  fabShell: {
    position: "absolute",
    top: -56,
    right: 18,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(200,145,74,0.55)",
    backgroundColor: "#c8914a",
  },
  fabButton: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  editorScreen: { flex: 1, backgroundColor: "#0A1628", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  editorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  editorCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(122,143,166,0.2)",
  },
  editorSaveBtn: { borderRadius: 999, backgroundColor: "#5ECFB1", paddingHorizontal: 18, paddingVertical: 10 },
  editorSaveBtnDisabled: { opacity: 0.5 },
  editorSaveText: { color: "#0A1628", fontFamily: AppTheme.fonts.bodyBold, fontSize: 13 },
  editorInput: {
    minHeight: 240,
    borderRadius: 20,
    backgroundColor: "rgba(20,46,88,0.72)",
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  editorBottomRow: { marginTop: 8, flexDirection: "row", justifyContent: "flex-end" },
  editorWordCount: { color: "#7A8FA6", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  reflectBtn: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200,145,74,0.6)",
    backgroundColor: "rgba(200,145,74,0.14)",
    paddingVertical: 10,
    alignItems: "center",
  },
  reflectBtnText: { color: "#EAC58E", fontFamily: AppTheme.fonts.bodyBold, fontSize: 13 },
  reflectLoading: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  reflectLoadingText: { color: "#D0DBEA", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 13 },
  moodRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  moodBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(98,126,162,0.35)",
    backgroundColor: "rgba(19,43,79,0.9)",
    paddingVertical: 10,
    alignItems: "center",
  },
  moodBtnActive: { borderColor: "#5ECFB1", backgroundColor: "rgba(94,207,177,0.18)" },
  moodBtnText: { color: "#F0EDE8", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 13 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
});
