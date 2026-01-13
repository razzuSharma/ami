import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={["#130820", "#0a0714", "#08060f"]}
      className="flex-1"
    >
      <View style={{ paddingTop: insets.top }} className="flex-1 px-6">
        {/* Header */}
        <View className="items-center mt-6">
          <View className="relative">
            {/* Glow */}
            <View className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl" />

            <View className="w-28 h-28 rounded-full overflow-hidden border border-white/20">
              <Image
                source={require("../../assets/images/image-ami.png")}
                className="w-full h-full"
              />
            </View>
          </View>

          <Text className="text-white text-2xl font-semibold mt-4">
            Raju
          </Text>

          {/* Status */}
          <View className="mt-2 px-4 py-1 rounded-full bg-white/10 border border-white/15">
            <Text className="text-purple-200 text-sm">
              Feeling calm 🌙
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row justify-between mt-10">
          <StatCard label="Chats" value="128" />
          <StatCard label="Journals" value="42" />
          <StatCard label="Streak" value="7d" />
        </View>

        {/* Actions */}
        <View className="flex flex-column gap-5 justify-between mt-10 space-y-4">
          <PrimaryAction
            icon="book-outline"
            label="My Journal"
          />
          <PrimaryAction
            icon="heart-outline"
            label="Mood History"
          />
        </View>

        {/* Settings */}
        <View className="flex flex-column gap-5 justify-between mt-12 border-t border-white/10 pt-6 space-y-4">
          <SecondaryAction
            icon="settings-outline"
            label="Settings"
          />
          <SecondaryAction
            icon="lock-closed-outline"
            label="Privacy"
          />
          <SecondaryAction
            icon="log-out-outline"
            label="Logout"
            danger
          />
        </View>
      </View>
    </LinearGradient>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-[30%] items-center rounded-2xl bg-white/10 border border-white/15 py-4">
      <Text className="text-white text-xl font-semibold">{value}</Text>
      <Text className="text-purple-200 text-xs mt-1">{label}</Text>
    </View>
  );
}

function PrimaryAction({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <Pressable className="flex-row items-center justify-between px-5 py-4 rounded-2xl bg-purple-600/90">
      <View className="flex-row items-center">
        <Ionicons name={icon} size={22} color="white" />
        <Text className="text-white text-base font-medium ml-3">
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="white" />
    </Pressable>
  );
}

function SecondaryAction({
  icon,
  label,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
}) {
  return (
    <Pressable className="flex-row items-center justify-between px-5 py-4 rounded-2xl bg-white/5 border border-white/10">
      <View className="flex-row items-center">
        <Ionicons
          name={icon}
          size={22}
          color={danger ? "#f87171" : "#e5e7eb"}
        />
        <Text
          className={`ml-3 text-base ${
            danger ? "text-red-400" : "text-white"
          }`}
        >
          {label}
        </Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={22}
        color={danger ? "#f87171" : "#9ca3af"}
      />
    </Pressable>
  );
}
