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

type TabName = "index" | "checkins" | "profile";

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
  profile: { icon: "ion", activeIcon: "person", inactiveIcon: "person-outline", label: "Profile" },
};

function TabIcon({ routeName, focused }: { routeName: TabName; focused: boolean }) {
  const config = TAB_CONFIG[routeName];
  const IconComponent = config.icon === "material" ? MaterialIcons : Ionicons;
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
      <IconComponent
        name={iconName as any}
        size={22}
        color={focused ? AppTheme.colors.textPrimary : AppTheme.colors.textMuted}
      />
      <Text style={[styles.iconLabel, focused && styles.iconLabelActive]}>{config.label}</Text>
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
          const validRouteName: TabName = (["index", "checkins", "profile"] as const).includes(
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
      <Tabs.Screen name="profile" />
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
    height: 72,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
    paddingTop: 8,
  },
  tabBackgroundWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: AppTheme.colors.surfaceBorder,
    backgroundColor: AppTheme.colors.surface,
  },
  tabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,22,40,0.55)",
  },
  iconWrap: {
    width: 72,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  activeGlow: {
    position: "absolute",
    width: 44,
    height: 22,
    borderRadius: 22,
    backgroundColor: AppTheme.colors.glowTeal,
    bottom: 20,
  },
  iconLabel: {
    marginTop: 2,
    color: AppTheme.colors.textMuted,
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 11,
  },
  iconLabelActive: {
    color: AppTheme.colors.textPrimary,
  },
});
