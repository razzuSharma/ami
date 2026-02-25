import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { design, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../helper/supabaseClient";

type Entry = {
  id: string;
  text: string;
  date: string;
};

export default function JournalScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEntry, setNewEntry] = useState("");

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

    const mapped = (data ?? []).map((item) => ({
      id: item.id,
      text: item.content ?? "",
      date: new Date(item.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }));
    setEntries(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const addEntry = async () => {
    if (!newEntry.trim() || !user) return;
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
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>Private entries for your day-to-day reflection.</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={design.colors.accentStart} />
            </View>
          ) : entries.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(360)} style={styles.emptyCard}>
              <Ionicons name="book-outline" size={22} color={design.colors.accentStart} />
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyBody}>Write a first note to start your timeline.</Text>
            </Animated.View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.entryCard}>
                  <Text style={styles.entryText}>{item.text}</Text>
                  <Text style={styles.entryDate}>{item.date}</Text>
                </View>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          <Pressable
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={22} color={design.colors.textPrimary} />
          </Pressable>
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
                placeholderTextColor={design.colors.mutedInk}
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
                    <ActivityIndicator color={design.colors.textPrimary} />
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
    paddingHorizontal: design.space.xl,
    paddingTop: 12,
    paddingBottom: 120,
  },
  title: {
    color: design.colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: design.colors.textSecondary,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
  },
  loadingWrap: {
    marginTop: 30,
    alignItems: "center",
  },
  listContent: {
    gap: 10,
  },
  emptyCard: {
    borderRadius: design.radius.xl,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: design.colors.textPrimary,
    marginTop: 10,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyBody: {
    color: design.colors.textSecondary,
    marginTop: 6,
    fontSize: 14,
    textAlign: "center",
  },
  entryCard: {
    borderRadius: design.radius.lg,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
    padding: design.space.md,
  },
  entryText: {
    color: design.colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  entryDate: {
    color: design.colors.textSecondary,
    fontSize: 12,
  },
  addButton: {
    position: "absolute",
    right: 26,
    bottom: 112,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: design.colors.accentEnd,
    borderWidth: 1,
    borderColor: "rgba(94,207,177,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: design.radius.xl,
    backgroundColor: "#102332",
    borderWidth: 1,
    borderColor: design.colors.border,
    padding: design.space.lg,
  },
  modalTitle: {
    color: design.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    minHeight: 120,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: design.space.md,
    color: design.colors.textPrimary,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelButton: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: "center",
  },
  cancelText: {
    color: design.colors.textSecondary,
    fontWeight: "600",
  },
  saveButton: {
    borderRadius: design.radius.md,
    backgroundColor: design.colors.accentEnd,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: "center",
  },
  saveText: {
    color: design.colors.textPrimary,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
