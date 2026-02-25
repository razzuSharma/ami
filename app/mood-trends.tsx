import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  const [allPoints, setAllPoints] = useState<CheckinPoint[]>([]);
  const [range, setRange] = useState<RangeKey>("1M");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const nowText = useMemo(
    () =>
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [],
  );

  useEffect(() => {
    const loadTrends = async () => {
      if (!user) {
        setAllPoints([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError("");

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
        setLoadError("Could not load mood trends.");
        setAllPoints([]);
        setLoading(false);
        return;
      }

      const mapped = (data ?? [])
        .filter((row) => typeof row.mood === "number")
        .map((row) => ({
          date: row.date,
          mood: Number(row.mood),
        }));

      setAllPoints(mapped);
      setLoading(false);
    };

    loadTrends();
  }, [user]);

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

  const chartPoints = useMemo(() => samplePoints(filteredPoints, 6), [filteredPoints]);

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
              <Text style={styles.backBtnText}>Profile</Text>
            </Pressable>

            <Text style={styles.title}>Mood Trends</Text>
            <Text style={styles.subtitle}>Your emotional patterns over time</Text>

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
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryEmoji}>{topMoodMeta.icon}</Text>
                <Text style={styles.summaryMain}>{topMoodMeta.label}</Text>
                <Text style={styles.summarySub}>Top mood</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryEmoji}>📈</Text>
                <Text style={styles.summaryMain}>
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(0)}%
                </Text>
                <Text style={styles.summarySub}>vs previous</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryEmoji}>🔥</Text>
                <Text style={styles.summaryMain}>{streak}d</Text>
                <Text style={styles.summarySub}>Streak</Text>
              </View>
            </View>

            {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Mood over time</Text>
                <Text style={styles.chartMonth}>
                  {new Date().toLocaleDateString("en-US", { month: "long" })}
                </Text>
              </View>

              {loading ? (
                <Text style={styles.emptyText}>Loading trend data...</Text>
              ) : chartPoints.length === 0 ? (
                <Text style={styles.emptyText}>No mood check-ins yet.</Text>
              ) : (
                <View style={styles.plainChartWrap}>
                  {chartRows.map((row) => (
                    <View key={row.key} style={styles.plainChartRow}>
                      <Text
                        style={[styles.chartLabelText, row.isLast && styles.chartLabelTextLast]}
                      >
                        {row.isLast ? "Today" : row.label}
                      </Text>
                      <View style={styles.plainTrack}>
                        <View
                          style={[
                            styles.plainFill,
                            { width: `${Math.max(10, row.mood * 24)}%` },
                            row.isLast && styles.plainFillLast,
                          ]}
                        />
                      </View>
                      <Text style={styles.plainValue}>{row.mood.toFixed(1)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.chartTitle}>Emotion breakdown</Text>
              {breakdown.map((item) => (
                <View key={item.key} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    {item.icon} {item.label}
                  </Text>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.max(8, item.percentage)}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={styles.breakdownPct}>{item.percentage}%</Text>
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
            <View style={styles.navItem}>
              <Ionicons
                name="pulse-outline"
                size={20}
                color={AppTheme.colors.accentPrimary}
              />
              <Text style={styles.navTextActive}>Trends</Text>
            </View>
            <Pressable
              onPress={() => router.replace("/(tabs)/profile")}
              style={styles.navItem}
            >
              <Ionicons name="person-outline" size={20} color={AppTheme.colors.textMuted} />
              <Text style={styles.navText}>Profile</Text>
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
    paddingBottom: 140,
    gap: 12,
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
    alignSelf: "flex-start",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(19, 41, 76, 0.55)",
  },
  backBtnText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  title: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 47,
    lineHeight: 52,
  },
  subtitle: {
    marginTop: -7,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
  },
  segmentWrap: {
    marginTop: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(103, 136, 182, 0.24)",
    backgroundColor: "rgba(20, 46, 88, 0.85)",
    flexDirection: "row",
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    height: 34,
  },
  segmentBtnActive: {
    backgroundColor: "rgba(86, 194, 174, 0.26)",
    borderWidth: 1,
    borderColor: "rgba(86, 194, 174, 0.45)",
  },
  segmentText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 13,
  },
  segmentTextActive: {
    color: AppTheme.colors.accentPrimary,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    alignItems: "center",
    paddingVertical: 14,
  },
  summaryEmoji: {
    fontSize: 21,
    marginBottom: 4,
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
    marginTop: 1,
  },
  errorText: {
    color: AppTheme.colors.danger,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 14,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  chartTitle: {
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 20,
  },
  chartMonth: {
    color: AppTheme.colors.accentPrimary,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  plainChartWrap: {
    marginTop: 6,
    gap: 10,
  },
  plainChartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  plainTrack: {
    flex: 1,
    height: 7,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "rgba(130, 159, 191, 0.22)",
    overflow: "hidden",
  },
  plainFill: {
    height: "100%",
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "#63d8c1",
  },
  plainFillLast: {
    backgroundColor: "#D7B686",
  },
  plainValue: {
    width: 28,
    textAlign: "right",
    color: "#9eb4d2",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 14,
    gap: 11,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  breakdownLabel: {
    width: 88,
    color: AppTheme.colors.textPrimary,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 15,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "rgba(130, 159, 191, 0.22)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: AppTheme.radius.pill,
  },
  breakdownPct: {
    width: 36,
    textAlign: "right",
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  avgText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
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
