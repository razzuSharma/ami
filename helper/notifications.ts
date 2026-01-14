import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications show when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Ask user permission to send notifications
export async function requestPermissions() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("daily-reminder", {
      name: "Daily Reminder",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Schedule a daily notification at 7:00 AM
export async function scheduleDailyReminder() {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    // Cancel previous notifications to avoid duplicates
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const sevenAM = new Date();
    sevenAM.setHours(7, 0, 0, 0);

    // If 7AM already passed today, schedule for tomorrow
    if (sevenAM <= now) sevenAM.setDate(sevenAM.getDate() + 1);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Good morning! 🌞",
        body: "Time for your daily check-in. How are you feeling today?",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: 7,
        minute: 0,
        repeats: true,  // Repeat daily
      },
    });
  } catch (error) {
    console.warn("Error scheduling daily reminder:", error);
  }
}
