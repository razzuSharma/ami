import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppTheme, gradients } from "../constants/design";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../helper/supabaseClient";

type CheckinPoint = {
  date: string;
  mood: number;
};

type RangeKey = "7D" | "1M" | "3M" | "ALL";

const RANGE_DAYS: Record<Exclude<RangeKey, "ALL">, number> = {
  "7D": 7,
  "1M": 30,
  "3M": 90,
};

const EMOTION_META = {
  anxious: { icon: "😰", color: "#A98CFF", value: 1, label: "Anxious" },
  tired: { icon: "😔", color: "#F0947A", value: 2, label: "Tired" },
  calm: { icon: "😊", color: "#5BD7C1", value: 3, label: "Calm" },
  happy: { icon: "😀", color: "#D8B886", value: 4, label: "Happy" },
} as const;

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getRangeStart(range: RangeKey) {
  if (range === "ALL") return null;
  const date = new Date();
  date.setDate(date.getDate() - (RANGE_DAYS[range] - 1));
  return toDateKey(date);
}

function moodToEmotion(mood: number) {
  if (mood <= 1.5) return "anxious";
  if (mood <= 2.5) return "tired";
  if (mood <= 3.5) return "calm";
  return "happy";
}

function samplePoints(points: CheckinPoint[], max = 6) {
  if (points.length <= max) return points;
  const sampled: CheckinPoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const index = Math.round((i / (max - 1)) * (points.length - 1));
    sampled.push(points[index]);
  }
  return sampled;
}

function computeStreak(points: CheckinPoint[]) {
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

export default function MoodTrendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("1M");

  const nowText = useMemo(
    () =>
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [],
  );

  const trendsQuery = useQuery({
    queryKey: ["mood-trends", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      const from = new Date();
      from.setDate(from.getDate() - 365);

      const { data, error } = await supabase
        .from("daily_checkins")
        .select("date,mood")
        .eq("user_id", user.id)
        .gte("date", toDateKey(from))
        .order("date", { ascending: true });

      if (error) {
        console.warn("Failed to load mood trends:", error.message);
        throw new Error(error.message);
      }

      return (data ?? [])
        .filter((row) => typeof row.mood === "number")
        .map((row) => ({
          date: row.date,
          mood: Number(row.mood),
        }));
    },
  });
  const allPoints = trendsQuery.data ?? [];
  const loading = trendsQuery.isLoading;
  const loadError = trendsQuery.isError ? "Could not load mood trends." : "";

  const filteredPoints = useMemo(() => {
    const start = getRangeStart(range);
    if (!start) return allPoints;
    return allPoints.filter((point) => point.date >= start);
  }, [allPoints, range]);

  const averageMood = useMemo(() => {
    if (!filteredPoints.length) return 0;
    return filteredPoints.reduce((sum, point) => sum + point.mood, 0) / filteredPoints.length;
  }, [filteredPoints]);

  const previousAverage = useMemo(() => {
    if (range === "ALL") return 0;
    const days = RANGE_DAYS[range];
    const end = new Date();
    end.setDate(end.getDate() - days);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);

    const prev = allPoints.filter((point) => point.date >= startKey && point.date <= endKey);
    if (!prev.length) return 0;
    return prev.reduce((sum, point) => sum + point.mood, 0) / prev.length;
  }, [allPoints, range]);

  const changePct = useMemo(() => {
    if (!previousAverage) return 0;
    return ((averageMood - previousAverage) / previousAverage) * 100;
  }, [averageMood, previousAverage]);

  const topMood = useMemo(() => {
    if (!filteredPoints.length) return "calm" as const;
    const counts = filteredPoints.reduce(
      (acc, point) => {
        const key = moodToEmotion(point.mood);
        acc[key] += 1;
        return acc;
      },
      { anxious: 0, tired: 0, calm: 0, happy: 0 },
    );

    return (Object.keys(counts) as Array<keyof typeof counts>).sort(
      (a, b) => counts[b] - counts[a],
    )[0];
  }, [filteredPoints]);

  const breakdown = useMemo(() => {
    const total = filteredPoints.length || 1;
    const counts = filteredPoints.reduce(
      (acc, point) => {
        const key = moodToEmotion(point.mood);
        acc[key] += 1;
        return acc;
      },
      { anxious: 0, tired: 0, calm: 0, happy: 0 },
    );

    return (Object.keys(EMOTION_META) as Array<keyof typeof EMOTION_META>).map((key) => ({
      key,
      ...EMOTION_META[key],
      percentage: Math.round((counts[key] / total) * 100),
    }));
  }, [filteredPoints]);

  const streak = useMemo(() => computeStreak(filteredPoints), [filteredPoints]);

  const chartPoints = useMemo(() => samplePoints(filteredPoints, 7), [filteredPoints]);

  const chartRows = useMemo(
    () =>
      chartPoints.map((point, index) => ({
        key: `${point.date}-${index}`,
        label: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        mood: point.mood,
        isLast: index === chartPoints.length - 1,
      })),
    [chartPoints],
  );

  const topMoodMeta = EMOTION_META[topMood];

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>{nowText}</Text>
              <Text style={styles.statusMeta}>51%</Text>
            </View>

            <View style={styles.titleRow}>
              <Pressable
                onPress={() => {
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
              </Pressable>
              <Text style={styles.title}>Mood Trends</Text>
            </View>
            <Text style={styles.subtitle}>Your emotional patterns over time</Text>
            <View style={styles.headerDivider} />

            <View style={styles.segmentWrap}>
              {(["7D", "1M", "3M", "ALL"] as const).map((option) => {
                const active = range === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setRange(option)}
                    style={({ pressed }) => [
                      styles.segmentBtn,
                      active && styles.segmentBtnActive,
                      pressed && styles.segmentPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.segmentLabelWrap,
                        active && styles.segmentLabelWrapActive,
                      ]}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {option}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryEmoji}>{topMoodMeta.icon}</Text>
                <Text style={styles.summaryMain}>{topMoodMeta.label}</Text>
                <Text style={styles.summarySub}>Top mood</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryTile}>
                <Text style={styles.summaryEmoji}>📈</Text>
                <Text style={styles.summaryMain}>
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(0)}%
                </Text>
                <Text style={styles.summarySub}>vs previous</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryTile}>
                <Text style={styles.summaryEmoji}>🔥</Text>
                <Text style={styles.summaryMain}>{streak}d</Text>
                <Text style={styles.summarySub}>Streak</Text>
              </View>
            </View>

            {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Mood over time</Text>
              </View>

              {loading ? (
                <Text style={styles.emptyText}>Loading trend data...</Text>
              ) : chartPoints.length === 0 ? (
                <Text style={styles.emptyText}>No mood check-ins yet.</Text>
              ) : (
                <View style={styles.sparkWrap}>
                  <View style={styles.sparkMidLine} />
                  {chartRows.length > 0 ? (
                    <View style={styles.sparkTooltip}>
                      <Text style={styles.sparkTooltipText}>
                        {chartRows[chartRows.length - 1].mood.toFixed(1)}
                      </Text>
                    </View>
                  ) : null}
                  {chartRows.map((row) => (
                    <View key={row.key} style={styles.sparkCol}>
                      <View style={styles.sparkTrack}>
                        <View
                          style={[
                            styles.sparkBar,
                            { height: `${Math.max(16, row.mood * 22)}%` },
                            row.isLast && styles.sparkBarLast,
                          ]}
                        />
                      </View>
                      <Text
                        style={[styles.chartLabelText, row.isLast && styles.chartLabelTextLast]}
                      >
                        {row.isLast ? "Today" : row.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.chartMonthCentered}>
                {new Date().toLocaleDateString("en-US", { month: "long" })}
              </Text>
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.chartTitle}>Emotion breakdown</Text>
              {breakdown.map((item) => (
                <View key={item.key} style={styles.breakdownRow}>
                  <View style={styles.breakdownTop}>
                    <Text style={styles.breakdownLabel}>
                      {item.icon} {item.label}
                    </Text>
                    <Text style={styles.breakdownPct}>{item.percentage}%</Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${item.percentage}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.avgText}>
              Average mood: {averageMood ? averageMood.toFixed(1) : "--"}
            </Text>
          </ScrollView>

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
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={AppTheme.colors.textMuted}
              />
              <Text style={styles.navText}>Check-in</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/(tabs)/profile")}
              style={styles.navItem}
            >
              <Ionicons name="person" size={20} color={AppTheme.colors.accentPrimary} />
              <Text style={styles.navTextActive}>Profile</Text>
            </Pressable>
          </View>
        </View>
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
    paddingTop: 8,
    paddingBottom: 120,
    gap: 22,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  statusText: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 22,
  },
  statusMeta: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  backBtn: {
    alignSelf: "center",
    marginRight: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(122,143,166,0.28)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  title: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: -14,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
  },
  headerDivider: {
    height: 1,
    backgroundColor: "rgba(122,143,166,0.2)",
    marginTop: -8,
  },
  segmentWrap: {
    marginTop: -4,
    borderRadius: 16,
    backgroundColor: "rgba(14, 32, 60, 0.9)",
    flexDirection: "row",
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    height: 46,
    marginHorizontal: 0,
    width: "100%",
    alignItems: "center",
  },
  segmentBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  segmentPressed: {
    opacity: 0.75,
  },
  segmentBtnActive: {
    backgroundColor: "rgba(59, 184, 154, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 184, 154, 0.45)",
  },
  segmentLabelWrap: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  segmentLabelWrapActive: {
    backgroundColor: "rgba(59,184,154,0.08)",
  },
  segmentText: {
    color: "#3D5A7A",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
  },
  segmentTextActive: {
    color: "#3BB89A",
    fontFamily: AppTheme.fonts.bodyBold,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(122,143,166,0.2)",
    backgroundColor: "rgba(19,43,79,0.55)",
    paddingVertical: 16,
  },
  summaryTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 4,
  },
  summaryEmoji: {
    fontSize: 28,
    marginBottom: 5,
  },
  summaryMain: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 18,
  },
  summarySub: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    color: AppTheme.colors.danger,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
  },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 16,
  },
  chartHeader: {
    marginBottom: 10,
  },
  chartTitle: {
    color: "#7F9DC4",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sparkWrap: {
    marginTop: 2,
    minHeight: 160,
    borderRadius: 14,
    backgroundColor: "rgba(8,26,52,0.35)",
    borderWidth: 1,
    borderColor: "rgba(122,143,166,0.12)",
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sparkMidLine: {
    position: "absolute",
    left: 10,
    right: 10,
    top: "50%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sparkTooltip: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#3BB89A",
    borderWidth: 1,
    borderColor: "#3BB89A",
  },
  sparkTooltipText: {
    color: "#FFFFFF",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 11,
  },
  sparkCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 7,
  },
  sparkTrack: {
    width: 20,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(130, 159, 191, 0.16)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  sparkBar: {
    width: "100%",
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "#63d8c1",
  },
  sparkBarLast: {
    backgroundColor: "#D7B686",
  },
  chartMonthCentered: {
    marginTop: 10,
    textAlign: "center",
    color: "#B8C5D6",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  chartLabelText: {
    color: "#7f9dc4",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 11,
  },
  chartLabelTextLast: {
    color: "#9eb4d2",
    fontFamily: AppTheme.fonts.bodyMedium,
  },
  emptyText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
    paddingVertical: 28,
  },
  breakdownCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 16,
    gap: 18,
    paddingBottom: 22,
  },
  breakdownRow: {
    gap: 8,
  },
  breakdownTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 16,
  },
  track: {
    height: 8,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "rgba(130, 159, 191, 0.22)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: AppTheme.radius.pill,
  },
  breakdownPct: {
    textAlign: "right",
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 13,
  },
  avgText: {
    marginTop: 2,
    textAlign: "center",
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
    textTransform: "none",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(98, 126, 162, 0.25)",
    backgroundColor: "rgba(7, 24, 48, 0.94)",
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
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
});
