import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { Colors } from "../../constants/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarStyle: {
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
          height: 52,
          borderRadius: 20,
          backgroundColor: "transparent",
          borderTopWidth: 0,

          // shadow
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
        },

        tabBarBackground: () => (
          <LinearGradient
            colors={["rgba(31,41,55,0.95)", "rgba(17,24,39,0.95)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              flex: 1,
              borderRadius: 28,
            }}
          />
        ),

        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.45)",

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },

        tabBarItemStyle: {
          marginVertical: 10,
        },

        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === "index") {
            return (
              <View
                style={{
                  alignItems: "center",
                  transform: [{ translateY: focused ? -2 : 0 }],
                }}
              >
                <Ionicons
                  name={focused ? "home" : "home-outline"}
                  size={focused ? 26 : 24}
                  color={color}
                />
                {focused && (
                  <View
                    style={{
                      marginTop: 4,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: Colors.accent,
                    }}
                  />
                )}
              </View>
            );
          }

          if (route.name === "checkins") {
            return (
              <View
                style={{
                  alignItems: "center",
                  transform: [{ translateY: focused ? -2 : 0 }],
                }}
              >
                <MaterialIcons
                  name={focused ? "check-circle" : "check-circle"}
                  size={focused ? 26 : 24}
                  color={color}
                />
                {focused && (
                  <View
                    style={{
                      marginTop: 4,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: Colors.accent,
                    }}
                  />
                )}
              </View>
            );
          }

          if (route.name === "profile") {
            return (
              <View
                style={{
                  alignItems: "center",
                  transform: [{ translateY: focused ? -2 : 0 }],
                }}
              >
                <Ionicons
                  name={focused ? "person-outline" : "person-outline"}
                  size={focused ? 26 : 24}
                  color={color}
                />
                {focused && (
                  <View
                    style={{
                      marginTop: 4,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: Colors.accent,
                    }}
                  />
                )}
              </View>
            );
          }

          return null;
        },

        tabBarShowLabel: false, // 🔥 cleaner, more premium
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="checkins" options={{ title: "Checkins" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
