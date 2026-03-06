import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type ToastContextType = {
  show: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const opacity = useState(new Animated.Value(0))[0];

  const show = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    setVisible(true);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [opacity]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {visible ? (
        <Animated.View style={[styles.toast, { opacity }]}>
          <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(13,27,42,0.96)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    color: "#f0ede8",
    fontSize: 13,
    textAlign: "center",
  },
});
