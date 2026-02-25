import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AppTheme, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
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

const moodPalette: Record<Entry["mood"], { accent: string; chip: string }> = {
  CALM: { accent: "#5BD7C1", chip: "rgba(91,215,193,0.2)" },
  HAPPY: { accent: "#D8B886", chip: "rgba(216,184,134,0.2)" },
  ANXIOUS: { accent: "#A98CFF", chip: "rgba(169,140,255,0.2)" },
  TIRED: { accent: "#F0947A", chip: "rgba(240,148,122,0.2)" },
};

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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState("");
  const [query, setQuery] = useState("");

  const loadEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id,content,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Failed to load journal entries:", error.message);
      setEntries([]);
      setLoading(false);
      return;
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

    setEntries(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

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

  const addEntry = async () => {
    if (!newEntry.trim() || !user) return;
    await ensureUserProfile(user);
    setSaving(true);
    const content = newEntry.trim();
    const title = content.split("\n")[0].slice(0, 80);

    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      title: title || null,
      content,
    });

    setSaving(false);
    if (error) {
      console.warn("Failed to save journal entry:", error.message);
      return;
    }

    setNewEntry("");
    setModalVisible(false);
    await loadEntries();
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/(tabs)/profile");
              }}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back to profile"
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={AppTheme.colors.textMuted}
              />
              <Text style={styles.backBtnText}>Back to profile</Text>
            </Pressable>

            <Text style={styles.pageTitle}>Journal</Text>
            <Text style={styles.entryMeta}>
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </Text>

            <View style={styles.searchWrap}>
              <Ionicons
                name="search"
                size={16}
                color={AppTheme.colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search entries..."
                placeholderTextColor={AppTheme.colors.textMuted}
                style={styles.searchInput}
              />
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={AppTheme.colors.accentPrimary} />
              </View>
            ) : filteredEntries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="book-outline"
                  size={24}
                  color={AppTheme.colors.accentPrimary}
                />
                <Text style={styles.emptyTitle}>No entries found</Text>
                <Text style={styles.emptyBody}>Try another search or add a new entry.</Text>
              </View>
            ) : (
              <View style={styles.timelineWrap}>
                <Text style={styles.monthHeading}>
                  {monthHeader(filteredEntries[0].dateISO)}
                </Text>

                {filteredEntries.map((entry) => {
                  const moodStyle = moodPalette[entry.mood];
                  return (
                    <Pressable
                      key={entry.id}
                      style={({ pressed }) => [
                        styles.entryCard,
                        { borderLeftColor: moodStyle.accent },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.entryTopRow}>
                        <Text style={styles.entryDateText}>{entry.dateLabel}</Text>
                        <View style={[styles.moodChip, { backgroundColor: moodStyle.chip }]}>
                          <Text style={[styles.moodChipText, { color: moodStyle.accent }]}>
                            {entry.mood}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.entryTitle}>{entry.title}</Text>
                      <Text style={styles.entryPreview}>{entry.preview}</Text>

                      <View style={styles.entryFooter}>
                        <Text style={styles.entryWords}>{entry.words} words</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={AppTheme.colors.textMuted}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <Pressable
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Create new journal entry"
          >
            <Ionicons name="add" size={28} color={AppTheme.colors.background} />
          </Pressable>

          <View style={styles.bottomNav}>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={styles.navItem}
            >
              <Ionicons name="home-outline" size={20} color={AppTheme.colors.textMuted} />
              <Text style={styles.navText}>Home</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/(tabs)/checkins")}
              style={styles.navItem}
            >
              <MaterialIcons
                name="check-circle-outline"
                size={20}
                color={AppTheme.colors.textMuted}
              />
              <Text style={styles.navText}>Check-in</Text>
            </Pressable>
            <View style={styles.navItem}>
              <Ionicons name="book" size={20} color={AppTheme.colors.accentPrimary} />
              <Text style={styles.navTextActive}>Journal</Text>
            </View>
          </View>
        </View>

        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New entry</Text>
              <TextInput
                style={styles.input}
                placeholder="What are you feeling today?"
                placeholderTextColor={AppTheme.colors.textMuted}
                value={newEntry}
                onChangeText={setNewEntry}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                  disabled={saving}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={addEntry}
                  style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={AppTheme.colors.textPrimary} />
                  ) : (
                    <Text style={styles.saveText}>Save</Text>
                  )}
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
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 140,
    gap: 14,
  },
  backBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(103, 136, 182, 0.22)",
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(14, 35, 66, 0.7)",
  },
  backBtnText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  pageTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 56,
    lineHeight: 58,
  },
  entryMeta: {
    marginTop: -10,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  searchWrap: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(103, 136, 182, 0.3)",
    backgroundColor: "rgba(20, 46, 88, 0.75)",
    paddingHorizontal: 13,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  fab: {
    position: "absolute",
    right: 14,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.colors.accentPrimary,
    borderWidth: 1,
    borderColor: "rgba(94, 207, 177, 0.5)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  loadingWrap: {
    marginTop: 20,
    alignItems: "center",
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(111, 159, 214, 0.24)",
    backgroundColor: "rgba(18, 39, 72, 0.72)",
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 22,
    marginTop: 6,
  },
  emptyTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    marginTop: 10,
    fontSize: 28,
  },
  emptyBody: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 240,
  },
  timelineWrap: {
    gap: 12,
  },
  monthHeading: {
    color: "#6A84A8",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 4,
  },
  entryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  entryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryDateText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  moodChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  moodChipText: {
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  entryTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 32,
    lineHeight: 35,
  },
  entryPreview: {
    color: "#9CB0CB",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
  },
  entryFooter: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(120, 149, 186, 0.14)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryWords: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(98, 126, 162, 0.3)",
    backgroundColor: "rgba(7, 24, 48, 0.96)",
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  navItem: {
    alignItems: "center",
    gap: 3,
    width: 80,
  },
  navText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 11,
  },
  navTextActive: {
    color: AppTheme.colors.accentPrimary,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
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
