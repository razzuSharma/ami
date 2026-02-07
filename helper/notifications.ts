import Constants from "expo-constants";
import { Platform } from "react-native";

let Notifications: typeof import("expo-notifications") | null = null;
let isLoading = false;

async function getNotificationsModule() {
  if (Notifications) return Notifications;
  if (isLoading) return null;

  try {
    isLoading = true;
    const module = await import("expo-notifications");
    Notifications = module.default || module;

    // Configure notifications when app is foregrounded
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return Notifications;
  } catch (error) {
    console.warn("Failed to load expo-notifications:", error);
    return null;
  } finally {
    isLoading = false;
  }
}

// Setup Android notification channel
export async function setupNotificationChannel() {
  const notifications = await getNotificationsModule();
  if (!notifications || Platform.OS !== "android") return;

  await notifications.setNotificationChannelAsync("daily-reminder", {
    name: "Daily Reminder",
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });
}

// Request notification permissions
export async function requestPermissions() {
  const notifications = await getNotificationsModule();
  if (!notifications) return false;

  await setupNotificationChannel();

  const { status } = await notifications.requestPermissionsAsync();
  return status === "granted";
}

// Schedule daily notification at 7:00 AM
export async function scheduleDailyReminder() {
  try {
    if (Constants.appOwnership === "expo") {
      console.log(
        "Skipping notifications in Expo Go. Use a development build for full support."
      );
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log("Notification permission not granted");
      return;
    }

    const notifications = await getNotificationsModule();
    if (!notifications) return;

    // Cancel previous scheduled notifications
    await notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const next7AM = new Date(now);
    next7AM.setHours(7, 0, 0, 0);
    if (next7AM <= now) next7AM.setDate(next7AM.getDate() + 1);

    if (Platform.OS === "ios") {
      // iOS supports calendar triggers
      await notifications.scheduleNotificationAsync({
        content: {
          title: "Good morning! 🌞",
          body: "Time for your daily check-in. How are you feeling today?",
          sound: true,
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: 7,
          minute: 0,
          repeats: true,
        },
      });
      console.log("Daily reminder scheduled for iOS");
    } else {
      // Android: use TIME_INTERVAL and reschedule after each notification
      const secondsUntil7AM = Math.max(
        1,
        Math.floor((next7AM.getTime() - now.getTime()) / 1000)
      );

      await notifications.scheduleNotificationAsync({
        content: {
          title: "Good morning! 🌞",
          body: "Time for your daily check-in. How are you feeling today?",
          sound: true,
          priority: notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntil7AM,
          repeats: false, // Will be rescheduled in listener
        },
      });
      console.log(
        `Daily reminder scheduled for Android in ${secondsUntil7AM}s (${next7AM.toLocaleString()})`
      );
    }
  } catch (error) {
    console.warn("Error scheduling daily reminder:", error);
  }
}

// Android: listen for notification received and reschedule next day
export async function setupNotificationListener() {
  const notifications = await getNotificationsModule();
  if (!notifications) return null;

  return notifications.addNotificationReceivedListener(async (notification) => {
    if (
      Platform.OS === "android" &&
      notification.request.content.title?.includes("Good morning")
    ) {
      console.log("Rescheduling Android daily notification...");
      setTimeout(scheduleDailyReminder, 2000); // Avoid immediate scheduling conflict
    }
  });
}
