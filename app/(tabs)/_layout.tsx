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
    <View style={{ 
      alignItems: "center", 
      justifyContent: "center", 
      flex: 1,
      position: "relative",
      minHeight: 60,
    }}>
      {/* Soft white glow */}
      {focused && (
        <View
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.08)",
            zIndex: 1,
          }}
        />
      )}

      {/* Icon Container */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          transform: [
            { translateY: focused ? -3 : 0 },
            { scale: focused ? 1.1 : 1 },
          ],
        }}
      >
        <IconComponent
          name={iconName as any}
          size={24}
          color={focused ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
        />
      </View>

      {/* Minimal indicator */}
      {focused && (
        <View
          style={{
            position: "absolute",
            bottom: 8,
            width: 20,
            height: 3,
            borderRadius: 2,
            backgroundColor: color,
            zIndex: 2,
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
          bottom: 30,
          left: 20,
          right: 20,
          height: 70,
          borderRadius: 35,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 16,
          paddingBottom: 0,
          paddingTop: 0,
        },

        tabBarBackground: () => (
          <View style={{ 
            flex: 1, 
            borderRadius: 35, 
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}>
            <LinearGradient
              colors={["#1f2937dd", "#111827dd"]}
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
