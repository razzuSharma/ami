import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { design, gradients } from "../../constants/design";

interface AppButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: "primary" | "ghost";
}

export function AppButton({
  label,
  onPress,
  disabled,
  style,
  variant = "primary",
}: AppButtonProps) {
  if (variant === "ghost") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.ghostButton,
          pressed && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        <Text style={styles.ghostLabel}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && styles.pressed, style, disabled && styles.disabled]}
    >
      <LinearGradient colors={gradients.accent ?? gradients.tealAccent} style={styles.primaryButton}>
        <Text style={styles.primaryLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    borderRadius: design.radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryLabel: {
    color: design.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  ghostButton: {
    borderRadius: design.radius.lg,
    borderWidth: 1,
    borderColor: design.colors.border,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: design.colors.surface,
  },
  ghostLabel: {
    color: design.colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
});
