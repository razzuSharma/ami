import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { design } from "../../constants/design";

interface AppInputProps extends TextInputProps {
  label: string;
}

export function AppInput({ label, ...props }: AppInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={design.colors.mutedInk}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: design.space.lg,
  },
  label: {
    color: design.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: design.space.xs,
    fontWeight: "700",
  },
  input: {
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
    color: design.colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: design.space.md,
    paddingVertical: 14,
  },
});
