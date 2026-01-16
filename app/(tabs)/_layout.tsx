import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { View } from "react-native";

type TabName = "index" | "checkins" | "profile";

const TAB_CONFIG: Record<
  TabName,
  {
    color: string;
    icon: "ion" | "material";
    activeIcon: string;
    inactiveIcon?: string;
  }
> = {
  index: {
    color: "#8B5CF6",
    icon: "ion",
    activeIcon: "home",
    inactiveIcon: "home-outline",
  },
  checkins: {
    color: "#22C55E",
    icon: "material",
    activeIcon: "check-circle",
  },
  profile: {
    color: "#3B82F6",
    icon: "ion",
    activeIcon: "person",
    inactiveIcon: "person-outline",
  },
};

interface TabIconProps {
  routeName: TabName;
  focused: boolean;
}

function TabIcon({ routeName, focused }: TabIconProps) {
  const config = TAB_CONFIG[routeName] || TAB_CONFIG.index; // Fallback to index if undefined
  const { color, icon, activeIcon, inactiveIcon } = config;

  const IconComponent = icon === "material" ? MaterialIcons : Ionicons;
  const iconName = focused || !inactiveIcon ? activeIcon : inactiveIcon;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {/* Soft white glow */}
      {focused && (
        <View
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        />
      )}

      {/* Icon */}
      <View
        style={{
          transform: [
            { translateY: focused ? -2 : 0 },
            { scale: focused ? 1.08 : 1 },
          ],
        }}
      >
        <IconComponent
          name={iconName as any}
          size={26}
          color={focused ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
        />
      </View>

      {/* Minimal indicator */}
      {focused && (
        <View
          style={{
            marginTop: 6,
            width: 16,
            height: 3,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,

        tabBarStyle: {
          position: "absolute",
          bottom: 18,
          left: 18,
          right: 18,
          height: 64,
          borderRadius: 32,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 16,
        },

        tabBarBackground: () => (
          <View style={{ flex: 1, borderRadius: 32, overflow: "hidden" }}>
            <LinearGradient
              colors={["#111827ee", "#020617ee"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
        ),

        tabBarIcon: ({ focused }) => {
          const validRouteName: TabName = (["index", "checkins", "profile"] as const).includes(route.name as TabName)
            ? (route.name as TabName)
            : "index";
          return <TabIcon routeName={validRouteName} focused={focused} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="checkins" options={{ title: "Checkins" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
