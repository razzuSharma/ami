import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/app-button";
import { design, gradients } from "../../constants/design";
import { useAuth } from "../../contexts/AuthContext";

const STEPS = ["Welcome", "How it works", "Your intent", "Personalize"] as const;

const INTENTS = [
  "Reduce stress",
  "Process emotions",
  "Build routine",
  "Just explore",
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<string>("Just explore");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [companionName, setCompanionName] = useState("Companion");

  const isLastStep = step === STEPS.length - 1;
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const finishOnboarding = async () => {
    if (!user?.id) {
      router.replace("/(auth)/welcome");
      return;
    }
    const cleanName = companionName.trim() || "Companion";
    await AsyncStorage.multiSet([
      [`onboarding-complete:${user.id}`, "1"],
      [`companion-name:${user.id}`, cleanName],
      [`onboarding-intent:${user.id}`, intent],
      [`reminders-enabled:${user.id}`, remindersEnabled ? "1" : "0"],
    ]);
    router.replace("/(tabs)");
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <Text style={styles.title}>Welcome to your private space</Text>
          <Text style={styles.body}>
            Ami helps you check in, write, and talk things through gently.
          </Text>
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <Text style={styles.title}>How Companion works</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• listens without judgment</Text>
            <Text style={styles.bullet}>• helps with reflection and journaling</Text>
            <Text style={styles.bullet}>• not emergency or clinical care</Text>
          </View>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <Text style={styles.title}>Set your intent</Text>
          <Text style={styles.body}>Pick what you want most from Ami right now.</Text>
          <View style={styles.chipWrap}>
            {INTENTS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setIntent(item)}
                style={[styles.chip, intent === item && styles.chipActive]}
              >
                <Text style={[styles.chipText, intent === item && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </>
      );
    }
    return (
      <>
        <Text style={styles.title}>Personalize your companion</Text>
        <Text style={styles.label}>Companion name</Text>
        <TextInput
          value={companionName}
          onChangeText={setCompanionName}
          maxLength={24}
          placeholder="Companion"
          placeholderTextColor={design.colors.mutedInk}
          style={styles.input}
        />
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>Daily reminders</Text>
            <Text style={styles.settingHint}>You can change this later in settings.</Text>
          </View>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            thumbColor={remindersEnabled ? "#EFD9B8" : "#E5E7EB"}
            trackColor={{ false: "rgba(255,255,255,0.25)", true: "rgba(200,145,74,0.55)" }}
          />
        </View>
      </>
    );
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Text style={styles.stepText}>{STEPS[step]}</Text>
            <Pressable onPress={finishOnboarding}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.card}>{renderStep()}</View>

          <View style={styles.actions}>
            {step > 0 ? (
              <AppButton label="Back" variant="ghost" onPress={() => setStep((prev) => prev - 1)} />
            ) : null}
            <AppButton
              label={isLastStep ? "Enter app" : "Continue"}
              onPress={() => {
                if (isLastStep) {
                  void finishOnboarding();
                } else {
                  setStep((prev) => prev + 1);
                }
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, paddingHorizontal: design.space.xl, paddingTop: 12, paddingBottom: 24 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepText: { color: "rgba(226,176,111,0.85)", fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  skip: { color: design.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: "#c8914a" },
  card: {
    marginTop: 18,
    borderRadius: design.radius.xl,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
    padding: design.space.lg,
    minHeight: 360,
  },
  title: { color: design.colors.textPrimary, fontSize: 30, fontWeight: "700", lineHeight: 36 },
  body: { marginTop: 12, color: design.colors.textSecondary, fontSize: 16, lineHeight: 24 },
  bulletList: { marginTop: 14, gap: 10 },
  bullet: { color: design.colors.textSecondary, fontSize: 15, lineHeight: 22 },
  chipWrap: { marginTop: 16, gap: 10 },
  chip: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  chipActive: { borderColor: "rgba(200,145,74,0.55)", backgroundColor: "rgba(200,145,74,0.15)" },
  chipText: { color: design.colors.textSecondary, fontSize: 14, fontWeight: "600" },
  chipTextActive: { color: "#EFD9B8" },
  label: {
    marginTop: 16,
    color: design.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  input: {
    marginTop: 8,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: design.colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  settingRow: {
    marginTop: 16,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingTitle: { color: design.colors.textPrimary, fontSize: 15, fontWeight: "700" },
  settingHint: { color: design.colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { marginTop: "auto", gap: 10 },
});
