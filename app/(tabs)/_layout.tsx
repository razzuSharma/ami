import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppTheme } from "../../constants/design";

type TabName = "index" | "checkins" | "companion" | "profile";

const TAB_CONFIG: Record<
  TabName,
  {
    activeIcon: string;
    inactiveIcon?: string;
    icon: "ion" | "material";
    label: string;
  }
> = {
  index: { icon: "ion", activeIcon: "home", inactiveIcon: "home-outline", label: "Home" },
  checkins: {
    icon: "material",
    activeIcon: "check-circle",
    inactiveIcon: "check-circle-outline",
    label: "Check-in",
  },
  companion: {
    icon: "ion",
    activeIcon: "chatbubble-ellipses",
    inactiveIcon: "chatbubble-ellipses-outline",
    label: "Companion",
  },
  profile: { icon: "ion", activeIcon: "person", inactiveIcon: "person-outline", label: "Profile" },
};

function TabIcon({ routeName, focused }: { routeName: TabName; focused: boolean }) {
  const config = TAB_CONFIG[routeName];
  const iconName = focused || !config.inactiveIcon ? config.activeIcon : config.inactiveIcon;

  const pulse = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      return;
    }
    pulse.value = withTiming(0, { duration: 180 });
  }, [focused, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.24 + pulse.value * 0.18,
  }));

  return (
    <View style={styles.iconWrap}>
      {focused ? <Animated.View style={[styles.activeGlow, glowStyle]} /> : null}
      {config.icon === "material" ? (
        <MaterialIcons
          name={iconName as keyof typeof MaterialIcons.glyphMap}
          size={25}
          color={focused ? AppTheme.colors.textPrimary : AppTheme.colors.textMuted}
        />
      ) : (
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={25}
          color={focused ? AppTheme.colors.textPrimary : AppTheme.colors.textMuted}
        />
      )}
      {focused ? <Text style={[styles.iconLabel, styles.iconLabelActive]}>{config.label}</Text> : null}
      {focused && routeName === "companion" ? <View style={styles.activeUnderline} /> : null}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={styles.tabBackgroundWrap}>
            <View style={styles.tabOverlay} />
          </View>
        ),
        tabBarIcon: ({ focused }) => {
          const validRouteName: TabName = (["index", "checkins", "companion", "profile"] as const).includes(
            route.name as TabName
          )
            ? (route.name as TabName)
            : "index";
          return <TabIcon routeName={validRouteName} focused={focused} />;
        },
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="checkins" />
      <Tabs.Screen name="companion" options={{ lazy: true }} />
      <Tabs.Screen name="profile" options={{ lazy: true }} />
      <Tabs.Screen name="splash" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 22,
    left: 16,
    right: 16,
    height: 76,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
    paddingTop: 10,
  },
  tabBackgroundWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,27,42,0.55)",
  },
  iconWrap: {
    width: 74,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  activeGlow: {
    position: "absolute",
    width: 48,
    height: 24,
    borderRadius: 22,
    backgroundColor: "rgba(226,176,111,0.32)",
    bottom: 22,
  },
  iconLabel: {
    marginTop: 1,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 10,
  },
  iconLabelActive: {
    color: "#EFD9B8",
  },
  activeUnderline: {
    marginTop: 2,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#E2B06F",
  },
});
