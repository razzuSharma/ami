import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { AppTheme, gradients } from "../constants/design";
import { useAuth } from "../contexts/AuthContext";
import { moodColorFromValue, moodLabelFromValue, moodScoreFromValue } from "../helper/mood";
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

function pathFromPoints(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function areaFromPoints(points: { x: number; y: number }[], baseY: number) {
  if (points.length === 0) return "";
  const line = pathFromPoints(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={styles.skeletonBlock} />
      <View style={[styles.skeletonBlock, styles.skeletonSub]} />
    </View>
  );
}

function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <Text style={styles.errorText}>{text}</Text>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function BreakdownBar({
  label,
  icon,
  color,
  percentage,
}: {
  label: string;
  icon: string;
  color: string;
  percentage: number;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const widthPct = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [percentage, widthAnim]);

  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownTop}>
        <Text style={styles.breakdownLabel}>{icon} {label}</Text>
        <Text style={styles.breakdownPct}>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: widthPct, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function MoodTrendsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeKey>("1M");
  const [selectedPoint, setSelectedPoint] = useState<CheckinPoint | null>(null);
  const svgSupported = useMemo(() => {
    try {
      return Boolean(UIManager.getViewManagerConfig?.("RNSVGPath"));
    } catch {
      return false;
    }
  }, []);

  const trendsQuery = useQuery({
    queryKey: queryKeys.moodTrends(user?.id ?? "anonymous", range),
    enabled: Boolean(user?.id),
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [] as CheckinPoint[];
      const start = getRangeStart(range);
      const { data, error } = await supabase
        .from("daily_checkins")
        .select("date,mood")
        .eq("user_id", user.id)
        .gte("date", start ?? "1900-01-01")
        .order("date", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        date: row.date,
        mood: moodScoreFromValue(row.mood),
      }));
    },
  });

  const filteredPoints = useMemo(() => trendsQuery.data ?? [], [trendsQuery.data]);

  const chartWidth = 320;
  const chartHeight = 190;
  const chartPadding = 18;
  const yMin = 1;
  const yMax = 5;

  const chartPoints = useMemo(() => {
    if (filteredPoints.length === 0) return [];
    const xStep =
      filteredPoints.length > 1
        ? (chartWidth - chartPadding * 2) / (filteredPoints.length - 1)
        : 0;
    return filteredPoints.map((point, idx) => {
      const ratio = (point.mood - yMin) / (yMax - yMin);
      return {
        ...point,
        x: chartPadding + idx * xStep,
        y: chartHeight - chartPadding - ratio * (chartHeight - chartPadding * 2),
      };
    });
  }, [filteredPoints]);

  const linePath = useMemo(() => pathFromPoints(chartPoints), [chartPoints]);
  const areaPath = useMemo(() => areaFromPoints(chartPoints, chartHeight - chartPadding), [chartPoints]);

  const breakdown = useMemo(() => {
    const total = filteredPoints.length || 1;
    const buckets = [
      { key: "anxious", label: "Anxious", icon: "😰", color: "#A98CFF", count: 0 },
      { key: "tired", label: "Tired", icon: "😔", color: "#F0947A", count: 0 },
      { key: "calm", label: "Calm", icon: "😌", color: "#5BD7C1", count: 0 },
      { key: "good", label: "Good+", icon: "🙂", color: "#D8B886", count: 0 },
    ];

    for (const point of filteredPoints) {
      if (point.mood <= 1) buckets[0].count += 1;
      else if (point.mood <= 2) buckets[1].count += 1;
      else if (point.mood <= 3) buckets[2].count += 1;
      else buckets[3].count += 1;
    }

    return buckets.map((item) => ({
      ...item,
      percentage: Math.round((item.count / total) * 100),
    }));
  }, [filteredPoints]);

  const averageMood = useMemo(() => {
    if (!filteredPoints.length) return 0;
    return filteredPoints.reduce((sum, point) => sum + point.mood, 0) / filteredPoints.length;
  }, [filteredPoints]);
  const topMood = useMemo(() => moodLabelFromValue(averageMood), [averageMood]);

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Pressable
                onPress={() => router.replace("/(tabs)/profile")}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={16} color={AppTheme.colors.textMuted} />
              </Pressable>
              <Text style={styles.title}>Mood Trends</Text>
            </View>
            <Text style={styles.subtitle}>Your emotional patterns over time</Text>

            <View style={styles.segmentWrap}>
              {(["7D", "1M", "3M", "ALL"] as const).map((option) => {
                const active = range === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setRange(option)}
                    style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Average mood</Text>
              <Text style={styles.summaryValue}>
                {averageMood ? averageMood.toFixed(1) : "--"} · {topMood}
              </Text>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Mood over time</Text>
              {trendsQuery.isLoading ? (
                <LoadingSkeleton />
              ) : trendsQuery.isError ? (
                <ErrorState text="Couldn't load mood trends." onRetry={() => trendsQuery.refetch()} />
              ) : chartPoints.length < 3 ? (
                <Text style={styles.emptyText}>Keep checking in - your trends will appear here 🌱</Text>
              ) : svgSupported ? (
                <View style={styles.svgWrap}>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <SvgGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#e2b06f" stopOpacity="0.32" />
                        <Stop offset="100%" stopColor="#4ecdc4" stopOpacity="0.04" />
                      </SvgGradient>
                    </Defs>
                    {[1, 2, 3, 4].map((tick) => {
                      const y =
                        chartPadding
                        + ((5 - tick) / (yMax - yMin)) * (chartHeight - chartPadding * 2);
                      return (
                        <Line
                          key={tick}
                          x1={chartPadding}
                          y1={y}
                          x2={chartWidth - chartPadding}
                          y2={y}
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth={1}
                          strokeDasharray="2 5"
                        />
                      );
                    })}
                    <Path d={areaPath} fill="url(#moodArea)" />
                    <Path d={linePath} stroke="#e2b06f" strokeWidth={2.4} fill="none" />
                    {chartPoints.map((point) => (
                      <Circle
                        key={`${point.date}-${point.x}`}
                        cx={point.x}
                        cy={point.y}
                        r={4.5}
                        fill={moodColorFromValue(point.mood)}
                        stroke="#fff"
                        strokeWidth={1}
                        onPress={() => setSelectedPoint({ date: point.date, mood: point.mood })}
                      />
                    ))}
                  </Svg>
                  {selectedPoint ? (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipText}>
                        {new Date(selectedPoint.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {moodLabelFromValue(selectedPoint.mood)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.fallbackChartWrap}>
                  {chartPoints.map((point) => (
                    <Pressable
                      key={`${point.date}-${point.x}`}
                      onPress={() => setSelectedPoint({ date: point.date, mood: point.mood })}
                      style={styles.fallbackCol}
                    >
                      <View style={styles.fallbackTrack}>
                        <View
                          style={[
                            styles.fallbackFill,
                            {
                              height: `${Math.max(18, point.mood * 18)}%`,
                              backgroundColor: moodColorFromValue(point.mood),
                            },
                          ]}
                        />
                      </View>
                      <View
                        style={[styles.fallbackDot, { backgroundColor: moodColorFromValue(point.mood) }]}
                      />
                    </Pressable>
                  ))}
                  {selectedPoint ? (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipText}>
                        {new Date(selectedPoint.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {moodLabelFromValue(selectedPoint.mood)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.chartTitle}>Emotion breakdown</Text>
              {trendsQuery.isLoading ? (
                <LoadingSkeleton />
              ) : trendsQuery.isError ? (
                <ErrorState text="Couldn't load emotion breakdown." onRetry={() => trendsQuery.refetch()} />
              ) : (
                breakdown.map((item) => (
                  <BreakdownBar
                    key={item.key}
                    label={item.label}
                    icon={item.icon}
                    color={item.color}
                    percentage={item.percentage}
                  />
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 120, gap: 18 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  backBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(122,143,166,0.28)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  title: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.serifDisplay, fontSize: 34 },
  subtitle: {
    marginTop: -12,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
  },
  segmentWrap: {
    borderRadius: 16,
    backgroundColor: "rgba(14, 32, 60, 0.9)",
    flexDirection: "row",
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    height: 46,
  },
  segmentBtn: { flex: 1, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  segmentBtnActive: {
    backgroundColor: "rgba(59, 184, 154, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(59, 184, 154, 0.45)",
  },
  segmentText: { color: "#3D5A7A", fontFamily: AppTheme.fonts.bodyRegular, fontSize: 13 },
  segmentTextActive: { color: "#3BB89A", fontFamily: AppTheme.fonts.bodyBold },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 14,
  },
  summaryTitle: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  summaryValue: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyBold, fontSize: 18, marginTop: 2 },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 14,
  },
  chartTitle: {
    color: "#7F9DC4",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  svgWrap: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "rgba(8,26,52,0.35)",
    paddingTop: 8,
    paddingBottom: 8,
  },
  fallbackChartWrap: {
    marginTop: 10,
    minHeight: 180,
    borderRadius: 12,
    backgroundColor: "rgba(8,26,52,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  fallbackCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  fallbackTrack: {
    width: 14,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fallbackFill: {
    width: "100%",
    borderRadius: 999,
  },
  fallbackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltip: {
    marginTop: 8,
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(200,145,74,0.2)",
    borderWidth: 1,
    borderColor: "rgba(200,145,74,0.55)",
  },
  tooltipText: { color: "#E8C898", fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  emptyText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 14,
    paddingVertical: 26,
  },
  breakdownCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 131, 177, 0.2)",
    backgroundColor: "rgba(19, 43, 79, 0.88)",
    padding: 14,
    gap: 14,
  },
  breakdownRow: { gap: 8 },
  breakdownTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { color: AppTheme.colors.textPrimary, fontFamily: AppTheme.fonts.bodyMedium, fontSize: 15 },
  breakdownPct: { color: AppTheme.colors.textMuted, fontFamily: AppTheme.fonts.bodyMedium, fontSize: 12 },
  track: {
    height: 8,
    borderRadius: AppTheme.radius.pill,
    backgroundColor: "rgba(130, 159, 191, 0.22)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: AppTheme.radius.pill },
  skeletonWrap: { marginTop: 8, gap: 10 },
  skeletonBlock: {
    height: 130,
    borderRadius: 12,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  skeletonSub: { height: 14, width: "74%" },
  errorWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  errorText: {
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 13,
  },
  retryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200,145,74,0.55)",
    backgroundColor: "rgba(200,145,74,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryText: {
    color: "#E8C898",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 12,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
