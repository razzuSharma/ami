import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { scheduleDailyReminder, setupNotificationListener } from "../../helper/notifications";

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // Set up notification listener for Android rescheduling
    const setupNotifications = async () => {
      try {
        const notificationSubscription = await setupNotificationListener();

        // Schedule notification in background to avoid blocking app render
        await scheduleDailyReminder();

        // Store subscription for cleanup
        if (notificationSubscription) {
          (window as any).__notificationSubscription = notificationSubscription;
        }
      } catch (error) {
        console.warn("Failed to set up notifications:", error);
      }
    };

    setupNotifications();

    // Cleanup subscription on unmount
    return () => {
      const subscription = (window as any).__notificationSubscription;
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.subtitle}>Welcome back,</Text>
            <Text style={styles.title}>Alex</Text>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="settings-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Hero Image */}
        <View style={styles.heroWrapper}>
          <View style={styles.heroImageFrame}>
            <Image
              source={require("../../assets/images/image-ami.png")}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
        </View>

        {/* Headline */}
        <View style={styles.headline}>
          <Text style={styles.headlineText}>
            How are you feeling{"\n"}today?
          </Text>
          <Text style={styles.headlineSub}>
            I'm here to listen whenever you're ready.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.card, styles.cardPrimary]}
            onPress={() => router.push("/chat")}
          >
            <View style={styles.cardContent}>
              <View style={[styles.cardAvatar, styles.cardAvatarPrimary]}>
                <Ionicons name="mic-outline" size={24} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Talk to me</Text>
                <Text style={styles.cardSubtitle}>Voice chat</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward-outline" size={24} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardSecondary]}
            onPress={() => router.push("/journal")}
          >
            <View style={styles.cardContent}>
              <View style={[styles.cardAvatar, styles.cardAvatarSecondary]}>
                <Ionicons name="create-outline" size={24} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Write something</Text>
                <Text style={styles.cardSubtitle}>Journal entry</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.recentWrapper}>
          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentLabel}>Last Check-in</Text>
              <Text style={styles.recentLabel}>Yesterday</Text>
            </View>
            <Text style={styles.recentBody}>
              "I was feeling a bit overwhelmed by the upcoming project, but
              talking it through helped clarify my next steps..."
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1021",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrapper: {
    alignItems: "center",
    paddingVertical: 16,
  },
  heroImageFrame: {
    width: 192,
    height: 192,
    borderRadius: 96,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  headline: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: "center",
  },
  headlineText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
  },
  headlineSub: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  actions: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    height: 80,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  cardPrimary: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cardSecondary: {
    backgroundColor: "rgba(59,130,246,0.8)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cardAvatarPrimary: {
    backgroundColor: "#ba30e8",
  },
  cardAvatarSecondary: {
    backgroundColor: "rgba(59,130,246,0.8)",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  recentWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  recentCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 20,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recentLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  recentBody: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    lineHeight: 20,
  },
});
