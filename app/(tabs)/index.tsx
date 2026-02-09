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
            <Ionicons name="settings-outline" size={24} color="#faf8f5" />
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
                <Ionicons name="mic-outline" size={24} color="#faf8f5" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Talk to me</Text>
                <Text style={styles.cardSubtitle}>Voice chat</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward-outline" size={24} color="#faf8f5" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.cardSecondary]}
            onPress={() => router.push("/journal")}
          >
            <View style={styles.cardContent}>
              <View style={[styles.cardAvatar, styles.cardAvatarSecondary]}>
                <Ionicons name="create-outline" size={24} color="#faf8f5" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Write something</Text>
                <Text style={styles.cardSubtitle}>Journal entry</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward-outline" size={24} color="#faf8f5" />
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
    backgroundColor: "#1a1625",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 20,
  },
  subtitle: {
    color: "rgba(250,248,245,0.65)",
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    color: "#faf8f5",
    fontSize: 22,
    fontWeight: "700",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrapper: {
    alignItems: "center",
    paddingVertical: 20,
  },
  heroImageFrame: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: "hidden",
    shadowColor: "#a78bfa",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  headline: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: "center",
  },
  headlineText: {
    color: "#faf8f5",
    fontSize: 23,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 30,
  },
  headlineSub: {
    color: "rgba(250,248,245,0.7)",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 22,
  },
  actions: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 18,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 28,
    height: 88,
    paddingHorizontal: 26,
    shadowColor: "#1a1625",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
  },
  cardPrimary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardSecondary: {
    backgroundColor: "rgba(196,181,253,0.35)",
    borderColor: "rgba(167,139,250,0.3)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  cardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#a78bfa",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  cardAvatarPrimary: {
    backgroundColor: "rgba(124,58,237,0.9)",
  },
  cardAvatarSecondary: {
    backgroundColor: "rgba(196,181,253,0.5)",
  },
  cardTitle: {
    color: "#faf8f5",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSubtitle: {
    color: "rgba(250,248,245,0.65)",
    fontSize: 13,
  },
  recentWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  recentCard: {
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 24,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  recentLabel: {
    color: "rgba(250,248,245,0.5)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentBody: {
    color: "rgba(250,248,245,0.88)",
    fontSize: 15,
    lineHeight: 22,
  },
});
