import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      {config.icon === "material" ? (
        <MaterialIcons
          name={iconName as keyof typeof MaterialIcons.glyphMap}
          size={22}
          color={focused ? "#F0EDE8" : AppTheme.colors.textMuted}
        />
      ) : (
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={22}
          color={focused ? "#F0EDE8" : AppTheme.colors.textMuted}
        />
      )}
      {focused ? <Text style={styles.iconLabel}>{config.label}</Text> : null}
      {focused ? <View style={styles.activeDot} /> : null}
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
    bottom: 14,
    left: 20,
    right: 20,
    height: 66,
    borderTopWidth: 0,
    backgroundColor: "transparent",
    elevation: 0,
    paddingTop: 8,
  },
  tabBackgroundWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(7,24,48,0.92)",
  },
  tabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  iconWrap: {
    width: 66,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  iconWrapActive: {
    borderWidth: 1,
    borderColor: "rgba(226,176,111,0.32)",
    backgroundColor: "rgba(226,176,111,0.11)",
  },
  iconLabel: {
    color: "#EFD9B8",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 9,
  },
  activeDot: {
    marginTop: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2B06F",
  },
});
