import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError() {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, info);
  }

  private handleRestart = async () => {
    try {
      // eslint-disable-next-line import/no-unresolved
      const Updates = await import("expo-updates");
      await Updates.reloadAsync();
    } catch (error) {
      console.error("Failed to reload app after crash", error);
    }
  };

  public render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Something went wrong - your data is safe</Text>
        <Pressable onPress={this.handleRestart} style={styles.button}>
          <Text style={styles.buttonText}>Restart</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0d1b2a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: "#f0ede8",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: "#f0ede8",
    fontSize: 14,
    fontWeight: "600",
  },
});
