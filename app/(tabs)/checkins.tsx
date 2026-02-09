import AsyncStorage from "@react-native-async-storage/async-storage";
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

const MOOD_OPTIONS = [
  { id: "sad", label: "Sad" },
  { id: "neutral", label: "Neutral" },
  { id: "good", label: "Good" },
  { id: "great", label: "Great" },
];

export default function DailyCheckin() {
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const data = await AsyncStorage.getItem(`checkin-${today}`);
      if (data) {
        const parsed = JSON.parse(data);
        setMood(parsed.mood);
        setNotes(parsed.notes ?? "");
        setSubmitted(true);
      }
    };
    load();
  }, []);

  const submitCheckin = async () => {
    if (!mood) {
      Alert.alert("Select a mood", "How are you feeling today?");
      return;
    }
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await AsyncStorage.setItem(
        `checkin-${today}`,
        JSON.stringify({ mood, notes }),
      );
      setSubmitted(true);
    } catch {
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  if (submitted) {
    const selectedLabel =
      MOOD_OPTIONS.find((m) => m.id === mood)?.label ?? mood;
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Check-in saved</Text>
          <Text style={styles.date}>{dateStr}</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Mood</Text>
            <Text style={styles.cardValue}>{selectedLabel}</Text>
          </View>
          {notes.trim() ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Notes</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Daily check-in</Text>
          <Text style={styles.date}>{dateStr}</Text>

          <Text style={styles.question}>How are you feeling?</Text>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.moodBtn,
                  mood === opt.id && styles.moodBtnActive,
                ]}
                onPress={() => setMood(opt.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.moodLabel,
                    mood === opt.id && styles.moodLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.question}>Notes (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Anything you'd like to note..."
            placeholderTextColor="#a78bfa"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={submitCheckin}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={styles.submitLabel}>
              {isSubmitting ? "Saving..." : "Save check-in"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#1a1625",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 52,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#faf8f5",
    marginBottom: 6,
  },
  date: {
    fontSize: 15,
    color: "rgba(196,181,253,0.85)",
    marginBottom: 32,
  },
  question: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(250,248,245,0.9)",
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  moodBtn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  moodBtnActive: {
    backgroundColor: "rgba(124,58,237,0.5)",
    borderColor: "rgba(167,139,250,0.6)",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(250,248,245,0.65)",
  },
  moodLabelActive: {
    color: "#faf8f5",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 18,
    minHeight: 108,
    fontSize: 16,
    color: "#faf8f5",
    marginBottom: 32,
  },
  submitBtn: {
    backgroundColor: "rgba(124,58,237,0.9)",
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: "rgba(100,116,139,0.5)",
    borderColor: "transparent",
    shadowOpacity: 0,
  },
  submitLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#faf8f5",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(196,181,253,0.8)",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  cardValue: {
    fontSize: 19,
    fontWeight: "600",
    color: "#faf8f5",
  },
  notesText: {
    fontSize: 16,
    color: "rgba(250,248,245,0.9)",
    lineHeight: 24,
  },
});
