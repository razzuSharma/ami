import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppTheme } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { getProfileCache, setProfileCache } from "../../helper/profileCache";
import { invalidateUserQueries, userQueryKeys } from "../../helper/queryCache";
import { supabase } from "../../helper/supabaseClient";
import { ensureUserProfile } from "../../helper/userProfile";

type Entry = {
  id: string;
  title: string;
  preview: string;
  dateISO: string;
  dateLabel: string;
  words: number;
  mood: "CALM" | "HAPPY" | "ANXIOUS" | "TIRED";
};

type DraftMood = "calm" | "happy" | "anxious" | null;

function inferMood(content: string, id: string): Entry["mood"] {
  const text = content.toLowerCase();
  if (/(calm|breathe|peace|still|quiet|meditat)/.test(text)) return "CALM";
  if (/(happy|good|great|win|grateful|excited)/.test(text)) return "HAPPY";
  if (/(anxious|stress|panic|worry|overwhelm)/.test(text)) return "ANXIOUS";
  if (/(tired|drain|exhaust|fatigue|sleep)/.test(text)) return "TIRED";

  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const moods: Entry["mood"][] = ["CALM", "HAPPY", "ANXIOUS", "TIRED"];
  return moods[seed % moods.length];
}

function splitEntry(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  const title = compact.slice(0, 46) || "Untitled entry";
  const preview = compact.length > 120 ? `${compact.slice(0, 120)}...` : compact;
  const words = compact ? compact.split(" ").filter(Boolean).length : 0;
  return { title, preview, words };
}

function monthHeader(dateISO: string) {
  return new Date(dateISO).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function JournalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState<DraftMood>(null);

  const entriesQuery = useQuery({
    queryKey: user?.id ? userQueryKeys(user.id).journalEntries : ["journal-entries", null],
    enabled: Boolean(user?.id),
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id,content,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Failed to load journal entries:", error.message);
        throw new Error(error.message);
      }

      const mapped: Entry[] = (data ?? []).map((item) => {
        const content = item.content ?? "";
        const details = splitEntry(content);
        return {
          id: item.id,
          title: details.title,
          preview: details.preview,
          words: details.words,
          mood: inferMood(content, item.id),
          dateISO: item.created_at,
          dateLabel: new Date(item.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        };
      });
      return mapped;
    },
  });
  const entries = entriesQuery.data ?? [];
  const loading = entriesQuery.isLoading;

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.preview.toLowerCase().includes(q) ||
        entry.mood.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const draftWordCount = useMemo(() => {
    const compact = newEntry.trim();
    if (!compact) return 0;
    return compact.split(/\s+/).filter(Boolean).length;
  }, [newEntry]);

  const addEntry = async () => {
    if (!newEntry.trim() || !user) return;
    await ensureUserProfile(user);
    setSaving(true);

    const content = newEntry.trim();
    const nowIso = new Date().toISOString();
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMood: Entry["mood"] =
      selectedMood === "calm"
        ? "CALM"
        : selectedMood === "happy"
          ? "HAPPY"
          : selectedMood === "anxious"
            ? "ANXIOUS"
            : inferMood(content, optimisticId);
    const optimisticSplit = splitEntry(content);
    const optimisticEntry: Entry = {
      id: optimisticId,
      title: optimisticSplit.title,
      preview: optimisticSplit.preview,
      words: optimisticSplit.words,
      mood: optimisticMood,
      dateISO: nowIso,
      dateLabel: new Date(nowIso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    };
    const keys = userQueryKeys(user.id);
    const previousEntries = queryClient.getQueryData<Entry[]>(keys.journalEntries) ?? [];
    queryClient.setQueryData<Entry[]>(keys.journalEntries, [optimisticEntry, ...previousEntries]);
    const previousProfileCache = getProfileCache(user.id);
    if (previousProfileCache) {
      setProfileCache({
        ...previousProfileCache,
        stats: {
          ...previousProfileCache.stats,
          journal: previousProfileCache.stats.journal + 1,
        },
        journalPreview: `Last entry · ${new Date(nowIso).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`,
        loadedAt: Date.now(),
      });
    }

    const title = content.split("\n")[0].slice(0, 80);
    const basePayload = {
      user_id: user.id,
      title: title || null,
      content,
    };

    let insertError: { message: string } | null = null;
    let inserted:
      | {
          id: string;
          content: string | null;
          created_at: string;
        }
      | null = null;

    const moodValue = selectedMood ? selectedMood.toUpperCase() : null;
    const firstInsert = await supabase
      .from("journal_entries")
      .insert({
        ...basePayload,
        mood: moodValue,
      })
      .select("id,content,created_at")
      .single();

    if (firstInsert.error) {
      const retryInsert = await supabase
        .from("journal_entries")
        .insert(basePayload)
        .select("id,content,created_at")
        .single();
      insertError = retryInsert.error;
      inserted = retryInsert.data;
    } else {
      inserted = firstInsert.data;
    }

    setSaving(false);

    if (insertError) {
      queryClient.setQueryData<Entry[]>(keys.journalEntries, previousEntries);
      if (previousProfileCache) {
        setProfileCache(previousProfileCache);
      }
      console.warn("Failed to save journal entry:", insertError.message);
      return;
    }

    if (inserted) {
      const insertedDetails = splitEntry(inserted.content ?? content);
      const persisted: Entry = {
        id: inserted.id,
        title: insertedDetails.title,
        preview: insertedDetails.preview,
        words: insertedDetails.words,
        mood: optimisticMood,
        dateISO: inserted.created_at,
        dateLabel: new Date(inserted.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
      queryClient.setQueryData<Entry[]>(keys.journalEntries, (current = []) =>
        current.map((entry) => (entry.id === optimisticId ? persisted : entry)),
      );
    }

    setNewEntry("");
    setSelectedMood(null);
    setModalVisible(false);
    await invalidateUserQueries(queryClient, user.id, "none");
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0A1628", "#0B1A31", "#0A1628"]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.titleRow}>
              <Pressable
                onPress={() => {
                  router.replace("/(tabs)/profile");
                }}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Go back to profile"
              >
                <Ionicons name="chevron-back" size={16} color="#7A8FA6" />
              </Pressable>
              <Text style={styles.pageTitle}>Journal</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </Text>
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
              <View style={styles.loadingWrap}>
                <ActivityIndicator color="#5ECFB1" />
              </View>
            ) : filteredEntries.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="book-outline" size={28} color="#5ECFB1" />
                <Text style={styles.emptyTitle}>Your journal is empty</Text>
                <Text style={styles.emptyBody}>Tap + to write your first entry</Text>
              </View>
            ) : (
              <View style={styles.timelineWrap}>
                <Text style={styles.monthHeading}>{monthHeader(filteredEntries[0].dateISO)}</Text>

                {filteredEntries.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={({ pressed }) => [styles.entryCard, pressed && styles.pressed]}
                  >
                    <View style={styles.entryTopRow}>
                      <Text style={styles.entryDateText}>{entry.dateLabel}</Text>
                      <Text style={styles.entryMoodText}>{entry.mood}</Text>
                    </View>

                    <Text style={styles.entryTitle}>{entry.title}</Text>
                    <Text style={styles.entryPreview}>{entry.preview}</Text>

                    <View style={styles.entryDivider} />

                    <View style={styles.entryFooter}>
                      <Text style={styles.entryWords}>{entry.words} words</Text>
                      <Ionicons name="chevron-forward" size={16} color="#8B94A3" />
                    </View>
                  </Pressable>
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
            <Pressable
              onPress={() => setModalVisible(true)}
              style={styles.fabButton}
              android_ripple={{ color: "rgba(28,28,30,0.1)", borderless: false }}
              accessibilityRole="button"
              accessibilityLabel="Create new journal entry"
            >
              <Ionicons name="add" size={24} color="#0A1628" />
            </Pressable>
          </View>
        </View>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => {
            setModalVisible(false);
            setSelectedMood(null);
          }}
        >
          <SafeAreaView style={styles.editorScreen}>
            <View style={styles.editorHeader}>
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setSelectedMood(null);
                }}
                style={({ pressed }) => [styles.editorCloseBtn, pressed && styles.pressed]}
                accessibilityLabel="Close editor"
              >
                <Ionicons name="close" size={20} color="#F0EDE8" />
              </Pressable>

              <Pressable
                onPress={addEntry}
              style={({ pressed }) => [
                  styles.editorSaveBtn,
                  (!newEntry.trim() || saving) && styles.editorSaveBtnDisabled,
                  pressed && styles.pressed,
                ]}
                disabled={!newEntry.trim() || saving}
                accessibilityLabel="Save entry"
              >
                <Text style={styles.editorSaveText}>{saving ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.editorInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#8B94A3"
              value={newEntry}
              onChangeText={setNewEntry}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.editorBottomRow}>
              <Text style={styles.editorWordCount}>{draftWordCount} words</Text>
            </View>

            <View style={styles.moodRow}>
              <Pressable
                onPress={() => setSelectedMood("calm")}
                style={[styles.moodBtn, selectedMood === "calm" && styles.moodBtnActive]}
              >
                <Text style={styles.moodBtnText}>😌 Calm</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedMood("happy")}
                style={[styles.moodBtn, selectedMood === "happy" && styles.moodBtnActive]}
              >
                <Text style={styles.moodBtnText}>😊 Happy</Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedMood("anxious")}
                style={[styles.moodBtn, selectedMood === "anxious" && styles.moodBtnActive]}
              >
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
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: 14,
    paddingBottom: 170,
    gap: 22,
  },
  backBtn: {
    alignSelf: "center",
    marginRight: 2,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(122,143,166,0.12)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -2,
  },
  pageTitle: {
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 36,
    lineHeight: 40,
  },
  countBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(122,143,166,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countBadgeText: {
    color: "#B8C5D6",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  searchWrap: {
    borderRadius: 15,
    backgroundColor: "rgba(20,46,88,0.75)",
    paddingHorizontal: 14,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  loadingWrap: {
    marginTop: 28,
    alignItems: "center",
  },
  emptyWrap: {
    marginTop: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 26,
  },
  emptyBody: {
    color: "#7A8FA6",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  timelineWrap: {
    gap: 14,
  },
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
  entryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryDateText: {
    color: "#7A8FA6",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  entryMoodText: {
    color: "#5ECFB1",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  entryTitle: {
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 20,
    lineHeight: 24,
  },
  entryPreview: {
    color: "#AFC0D7",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 21,
  },
  entryDivider: {
    height: 1,
    backgroundColor: "rgba(120,149,186,0.2)",
  },
  entryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryWords: {
    color: "#7A8FA6",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
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
    zIndex: 10,
    elevation: 2,
    overflow: "visible",
  },
  navItem: {
    alignItems: "center",
    gap: 3,
    width: 80,
  },
  navText: {
    color: "#7A8FA6",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 11,
  },
  navTextActive: {
    color: "#5ECFB1",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
  },
  fabShell: {
    position: "absolute",
    top: -56,
    right: 18,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: "rgba(94,207,177,0.5)",
    backgroundColor: "#5ECFB1",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    overflow: "hidden",
  },
  fabButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  editorScreen: {
    flex: 1,
    backgroundColor: "#0A1628",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
  },
  editorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editorCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(122,143,166,0.2)",
  },
  editorSaveBtn: {
    borderRadius: 999,
    backgroundColor: "#5ECFB1",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  editorSaveBtnDisabled: {
    opacity: 0.5,
  },
  editorSaveText: {
    color: "#0A1628",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 13,
  },
  editorInput: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: "rgba(20,46,88,0.72)",
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  editorBottomRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  editorWordCount: {
    color: "#7A8FA6",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  moodRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  moodBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(98,126,162,0.35)",
    backgroundColor: "rgba(19,43,79,0.9)",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  moodBtnActive: {
    borderColor: "#5ECFB1",
    backgroundColor: "rgba(94,207,177,0.18)",
  },
  moodBtnText: {
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 26,
    backgroundColor: "#102332",
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    padding: AppTheme.space.lg,
  },
  modalTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 20,
    marginBottom: 12,
  },
  input: {
    minHeight: 120,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: AppTheme.space.md,
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: "center",
  },
  cancelText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 14,
  },
  saveButton: {
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 92,
    alignItems: "center",
  },
  saveText: {
    color: AppTheme.colors.background,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
