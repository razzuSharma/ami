import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const moodOptions = [
  {
    emoji: "😞",
    label: "Sad",
    color: "#3b82f6",
    gradient: ["#1e3a8a", "#1e40af"] as const,
    accentGradient: ["#3b82f6", "#2563eb"] as const,
  },
  {
    emoji: "😐",
    label: "Neutral",
    color: "#06b6d4",
    gradient: ["#0c4a6e", "#0e7490"] as const,
    accentGradient: ["#06b6d4", "#0891b2"] as const,
  },
  {
    emoji: "😊",
    label: "Good",
    color: "#10b981",
    gradient: ["#064e3b", "#065f46"] as const,
    accentGradient: ["#10b981", "#059669"] as const,
  },
  {
    emoji: "😄",
    label: "Great",
    color: "#8b5cf6",
    gradient: ["#4c1d95", "#5b21b6"] as const,
    accentGradient: ["#8b5cf6", "#7c3aed"] as const,
  },
];

export default function DailyCheckin() {
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fadeAnim = useSharedValue(0);
  const scaleAnim = useSharedValue(0.8);
  const shimmerAnim = useSharedValue(0);
  const moodAnimations = moodOptions.reduce(
    (acc, option) => {
      acc[option.emoji] = useSharedValue(1);
      return acc;
    },
    {} as Record<string, any>
  );

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerAnim.value }],
  }));

  useEffect(() => {
    // Fade in animation on mount
    fadeAnim.value = withTiming(1, { duration: 800 });
    scaleAnim.value = withSpring(1, { damping: 12, stiffness: 80 });

    // Shimmer effect
    shimmerAnim.value = withRepeat(
      withTiming(300, { duration: 3000 }),
      -1,
      false
    );

    // Load today's check-in from storage if it exists
    const loadCheckin = async () => {
      const today = new Date().toISOString().split("T")[0];
      const data = await AsyncStorage.getItem(`checkin-${today}`);
      if (data) {
        const parsed = JSON.parse(data);
        setMood(parsed.mood);
        setNotes(parsed.notes);
        setSubmitted(true);
      }
    };
    loadCheckin();
  }, []);

  const animateMoodSelection = (selectedEmoji: string) => {
    // Reset all animations
    Object.values(moodAnimations).forEach((anim) => {
      anim.value = withSpring(1, { damping: 15, stiffness: 200 });
    });

    // Animate selected mood
    moodAnimations[selectedEmoji].value = withSequence(
      withSpring(1.3, { damping: 10, stiffness: 300 }),
      withSpring(1.15, { damping: 12, stiffness: 200 })
    );

    setMood(selectedEmoji);
  };

  const submitCheckin = async () => {
    if (!mood.trim()) {
      Alert.alert("Please select your mood!", "How are you feeling today?");
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      await AsyncStorage.setItem(
        `checkin-${today}`,
        JSON.stringify({ mood, notes })
      );

      // Success animation
      fadeAnim.value = withSequence(
        withTiming(0.7, { duration: 200 }),
        withTiming(1, { duration: 300 })
      );

      setTimeout(() => {
        setSubmitted(true);
        Alert.alert(
          "Check-in saved! 🎉",
          "Great job taking care of your mental health."
        );
      }, 500);
    } catch (error) {
      Alert.alert("Error", "Failed to save check-in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const selectedMoodData = moodOptions.find((m) => m.emoji === mood);
    return (
      <LinearGradient
        colors={["#0f172a", "#1e293b", "#0f172a"]}
        className="flex-1"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: 24,
              paddingTop: 60,
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={containerStyle}>
              <View className="relative">
                {/* Ambient glow */}
                <View className="absolute -inset-8 opacity-30">
                  <LinearGradient
                    colors={
                      selectedMoodData?.accentGradient || [
                        "#3b82f6",
                        "#2563eb",
                      ]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="w-full h-full rounded-full blur-3xl"
                  />
                </View>

                <View className="relative bg-slate-900/40 backdrop-blur-xl rounded-[32px] overflow-hidden border border-white/10">
                  <LinearGradient
                    colors={[
                      "rgba(59, 130, 246, 0.1)",
                      "rgba(37, 99, 235, 0.05)",
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0"
                  />

                  <View className="p-8">
                    {/* Success Icon */}
                    <View className="items-center mb-8">
                      <View className="relative mb-6">
                        <View className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl" />
                        <LinearGradient
                          colors={
                            selectedMoodData?.accentGradient || [
                              "#3b82f6",
                              "#2563eb",
                            ]
                          }
                          className="rounded-full p-6 shadow-2xl"
                        >
                          <Text className="text-7xl">{mood}</Text>
                        </LinearGradient>
                      </View>

                      <View className="items-center mb-4">
                        <Text className="text-white text-3xl font-bold mb-2 tracking-tight">
                          Check-In Complete!
                        </Text>
                        <View className="h-1 w-24 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full" />
                      </View>

                      <View className="bg-slate-800/60 backdrop-blur-sm px-5 py-2.5 rounded-full border border-blue-500/20">
                        <Text className="text-blue-300 text-sm font-medium">
                          {new Date().toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>

                    {/* Mood Summary Card */}
                    <View className="mb-4">
                      <LinearGradient
                        colors={[
                          "rgba(30, 41, 59, 0.6)",
                          "rgba(15, 23, 42, 0.4)",
                        ]}
                        className="rounded-3xl p-6 border border-white/5"
                      >
                        <Text className="text-blue-200 text-xs font-bold mb-4 uppercase tracking-widest opacity-70">
                          Your Mood Today
                        </Text>
                        <View className="flex-row items-center justify-center bg-slate-800/40 rounded-2xl p-4 border border-blue-500/10">
                          <View className="bg-blue-500/10 rounded-full p-3 mr-4">
                            <Text className="text-4xl">{mood}</Text>
                          </View>
                          <Text className="text-white text-2xl font-bold tracking-tight">
                            {selectedMoodData?.label || "Feeling"}
                          </Text>
                        </View>
                      </LinearGradient>
                    </View>

                    {/* Notes Card */}
                    {notes.trim() && (
                      <View className="mb-6">
                        <LinearGradient
                          colors={[
                            "rgba(30, 41, 59, 0.6)",
                            "rgba(15, 23, 42, 0.4)",
                          ]}
                          className="rounded-3xl p-6 border border-white/5"
                        >
                          <Text className="text-blue-200 text-xs font-bold mb-4 uppercase tracking-widest opacity-70">
                            Your Thoughts
                          </Text>
                          <Text className="text-slate-100 text-base leading-7 font-light">
                            "{notes}"
                          </Text>
                        </LinearGradient>
                      </View>
                    )}

                    {/* Footer */}
                    <View className="items-center pt-4">
                      <LinearGradient
                        colors={[
                          "rgba(59, 130, 246, 0.15)",
                          "rgba(37, 99, 235, 0.1)",
                        ]}
                        className="px-8 py-4 rounded-full border border-blue-400/20"
                      >
                        <Text className="text-blue-300 text-sm font-semibold tracking-wide">
                          ✨ See you tomorrow! ✨
                        </Text>
                      </LinearGradient>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#0f172a", "#1e293b", "#0f172a"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={containerStyle}>
            {/* Header Section */}
            <View className="mb-8">
              <View className="relative overflow-hidden bg-slate-900/40 backdrop-blur-xl rounded-[32px] border border-white/10">
                <LinearGradient
                  colors={[
                    "rgba(59, 130, 246, 0.15)",
                    "rgba(37, 99, 235, 0.08)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="absolute inset-0"
                />

                {/* Animated shimmer */}
                <Animated.View
                  style={[
                    shimmerStyle,
                    {
                      position: "absolute",
                      top: 0,
                      left: -100,
                      width: 100,
                      height: "100%",
                      opacity: 0.1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "transparent",
                      "rgba(255, 255, 255, 0.3)",
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="w-full h-full"
                  />
                </Animated.View>

                <View className="p-6">
                  <View className="items-center mb-2">
                    <Text className="text-white text-4xl font-bold mb-2 tracking-tight">
                      Daily Check-In
                    </Text>
                    <View className="h-1 w-24 bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-400 rounded-full mb-3" />
                  </View>

                  <Text className="text-slate-300 text-base text-center leading-6 mb-4 font-light">
                    Take a moment to reflect on your day and nurture your mental
                    wellness
                  </Text>

                  <View className="flex-row justify-center">
                    <LinearGradient
                      colors={[
                        "rgba(59, 130, 246, 0.2)",
                        "rgba(37, 99, 235, 0.15)",
                      ]}
                      className="px-5 py-2 rounded-full border border-blue-400/30"
                    >
                      <Text className="text-blue-300 text-xs font-semibold tracking-wide">
                        {new Date().toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </Text>
                    </LinearGradient>
                  </View>
                </View>
              </View>
            </View>

            {/* Mood Selection */}
            <View className="mb-6">
              <Text className="text-white text-xl font-bold mb-4 text-center tracking-tight">
                How are you feeling today?
              </Text>
              <View className="flex-row justify-between gap-2">
                {moodOptions.map((option) => {
                  const moodStyle = useAnimatedStyle(() => ({
                    transform: [{ scale: moodAnimations[option.emoji].value }],
                  }));

                  return (
                    <Animated.View
                      key={option.emoji}
                      style={moodStyle}
                      className="flex-1"
                    >
                      <TouchableOpacity
                        onPress={() => animateMoodSelection(option.emoji)}
                        activeOpacity={0.7}
                      >
                        <View className="relative">
                          {mood === option.emoji && (
                            <View className="absolute -inset-1 opacity-40">
                              <LinearGradient
                                colors={option.accentGradient}
                                className="w-full h-full rounded-2xl blur-xl"
                              />
                            </View>
                          )}

                          <LinearGradient
                            colors={
                              mood === option.emoji
                                ? option.gradient
                                : [
                                    "rgba(30, 41, 59, 0.4)",
                                    "rgba(15, 23, 42, 0.6)",
                                  ]
                            }
                            className={`items-center p-4 rounded-2xl border-2 ${
                              mood === option.emoji
                                ? "border-blue-400/50"
                                : "border-slate-700/50"
                            }`}
                          >
                            <View
                              className={`${mood === option.emoji ? "bg-white/10" : ""} rounded-full p-1 mb-1 items-center justify-center`}
                            >
                              <Text className="text-4xl drop-shadow-lg leading-none">
                                {option.emoji}
                              </Text>
                            </View>
                            <Text
                              className={`text-xs font-bold text-center tracking-wide ${
                                mood === option.emoji
                                  ? "text-white"
                                  : "text-slate-400"
                              }`}
                            >
                              {option.label}
                            </Text>
                          </LinearGradient>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>

            {/* Notes Section */}
            <View className="mb-6">
              <Text className="text-white text-lg font-bold mb-3 text-center tracking-tight">
                Notes & Thoughts
              </Text>
              <View className="relative">
                <LinearGradient
                  colors={["rgba(30, 41, 59, 0.6)", "rgba(15, 23, 42, 0.8)"]}
                  className="rounded-2xl overflow-hidden border border-slate-700/50"
                >
                  <TextInput
                    className="text-white p-4 min-h-[120px] text-sm leading-5"
                    placeholder="What's on your mind? Share your thoughts, feelings, or anything you'd like to remember..."
                    placeholderTextColor="#64748b"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    textAlignVertical="top"
                    selectionColor="#3b82f6"
                  />
                </LinearGradient>

                <View className="absolute -top-2 -right-2 bg-blue-500/20 rounded-full p-2 border border-blue-400/30 backdrop-blur-sm">
                  <Text className="text-xl">💭</Text>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={submitCheckin}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              <View className="relative">
                {!isSubmitting && (
                  <View className="absolute -inset-1 opacity-50">
                    <LinearGradient
                      colors={["#3b82f6", "#2563eb", "#1d4ed8"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="w-full h-full rounded-2xl blur-lg"
                    />
                  </View>
                )}

                <LinearGradient
                  colors={
                    isSubmitting
                      ? ["#475569", "#334155"]
                      : ["#3b82f6", "#2563eb", "#1d4ed8"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="rounded-2xl py-4 items-center border border-white/10"
                >
                  <Text
                    className={`font-bold text-lg tracking-wide ${
                      isSubmitting ? "text-slate-300" : "text-white"
                    }`}
                  >
                    {isSubmitting ? "✨ Saving..." : "Complete Check-In ✨"}
                  </Text>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}