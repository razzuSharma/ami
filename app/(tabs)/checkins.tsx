import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { design, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../helper/supabaseClient";

const MOOD_OPTIONS = [
  { id: "sad", label: "Low", value: 1 },
  { id: "neutral", label: "Flat", value: 2 },
  { id: "good", label: "Good", value: 3 },
  { id: "great", label: "Great", value: 4 },
];

export default function DailyCheckin() {
  const { user } = useAuth();
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("id,mood,notes")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) {
        console.warn("Failed to load daily check-in:", error.message);
        return;
      }

      if (!data) return;

      setExistingId(data.id);
      setMood(MOOD_OPTIONS.find((option) => option.value === data.mood)?.id ?? "");
      setNotes(data.notes ?? "");
      setSubmitted(true);
    };

    load();
  }, [user]);

  const submitCheckin = async () => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to save your check-in.");
      return;
    }

    if (!mood) {
      Alert.alert("Select a mood", "How are you feeling today?");
      return;
    }

    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const moodValue = MOOD_OPTIONS.find((option) => option.id === mood)?.value ?? null;

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
        if (error) throw error;
      } else {
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
        if (error) throw error;
        setExistingId(data.id);
      }

      setSubmitted(true);
    } catch (error) {
      console.warn("Failed to save daily check-in:", error);
      Alert.alert("Error", "Could not save your check-in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Daily check-in</Text>
            <Text style={styles.date}>{dateStr}</Text>

            <Animated.View entering={FadeInDown.duration(400)} style={styles.panel}>
              {submitted ? (
                <>
                  <Text style={styles.sectionTitle}>Saved for today</Text>
                  <Text style={styles.value}>
                    {MOOD_OPTIONS.find((m) => m.id === mood)?.label ?? mood}
                  </Text>
                  {notes.trim() ? <Text style={styles.savedNote}>{notes}</Text> : null}
                  <TouchableOpacity
                    onPress={() => setSubmitted(false)}
                    style={[styles.button, styles.ghostButton]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.ghostText}>Edit check-in</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>How do you feel right now?</Text>
                  <View style={styles.moodRow}>
                    {MOOD_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => setMood(opt.id)}
                        activeOpacity={0.85}
                        style={[styles.moodChip, mood === opt.id && styles.moodChipActive]}
                      >
                        <Text
                          style={[styles.moodLabel, mood === opt.id && styles.moodLabelActive]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
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

                  <TouchableOpacity
                    onPress={submitCheckin}
                    style={[styles.button, isSubmitting && styles.buttonDisabled]}
                    disabled={isSubmitting}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.buttonText}>
                      {isSubmitting ? "Saving..." : "Save check-in"}
                    </Text>
                  </TouchableOpacity>
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
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: design.space.xl,
    paddingTop: 16,
    paddingBottom: 120,
  },
  title: {
    color: design.colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
  },
  date: {
    color: design.colors.textSecondary,
    fontSize: 14,
    marginTop: 5,
    marginBottom: design.space.lg,
  },
  panel: {
    borderRadius: design.radius.xl,
    backgroundColor: design.colors.surface,
    borderWidth: 1,
    borderColor: design.colors.border,
    padding: design.space.lg,
  },
  sectionTitle: {
    color: design.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  moodChip: {
    flex: 1,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 13,
    alignItems: "center",
  },
  moodChipActive: {
    backgroundColor: design.colors.accentSoft,
    borderColor: "rgba(94,207,177,0.45)",
  },
  moodLabel: {
    color: design.colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
  moodLabelActive: {
    color: design.colors.textPrimary,
  },
  notesLabel: {
    color: design.colors.textSecondary,
    marginBottom: 8,
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
    marginBottom: 16,
  },
  button: {
    borderRadius: design.radius.lg,
    backgroundColor: design.colors.accentEnd,
    alignItems: "center",
    paddingVertical: 14,
  },
  buttonText: {
    color: design.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  value: {
    color: design.colors.accentStart,
    fontWeight: "700",
    fontSize: 22,
    marginBottom: 12,
  },
  savedNote: {
    color: design.colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 16,
  },
  ghostButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: design.colors.border,
  },
  ghostText: {
    color: design.colors.textSecondary,
    fontSize: 15,
    fontWeight: "700",
  },
});
