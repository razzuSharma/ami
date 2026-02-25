import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { design, gradients } from "../../constants/design";

type Message = {
  id: string;
  text: string;
  user: "bot" | "user";
};

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<Message>>(null);
  const [input, setInput] = useState("");

  const initialMessages = useMemo<Message[]>(
    () => [
      { id: "1", text: "Hi. I am here with you. How is your energy right now?", user: "bot" },
      { id: "2", text: "A little drained after work.", user: "user" },
      { id: "3", text: "That makes sense. Want to name one thing that felt heavy?", user: "bot" },
    ],
    []
  );

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
      user: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
  };

  return (
    <LinearGradient colors={gradients.appBackground} style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 64 : 0}
      >
        <View style={[styles.screen, { paddingTop: insets.top }]}>
          <Animated.View entering={FadeInDown.duration(380)} style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={design.colors.textPrimary} />
            </Pressable>

            <View style={styles.headerIdentity}>
              <Image source={require("../../assets/images/image-ami.png")} style={styles.avatar} />
              <View>
                <Text style={styles.headerTitle}>Ami</Text>
                <View style={styles.statusRow}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.statusText}>Online now</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isUser = item.user === "user";
              return (
                <Animated.View
                  entering={FadeInDown.duration(280)}
                  style={[styles.messageRow, isUser ? styles.userRow : styles.botRow]}
                >
                  <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
                    <Text style={styles.messageText}>{item.text}</Text>
                  </View>
                </Animated.View>
              );
            }}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />

          <Animated.View
            entering={FadeInDown.delay(80).duration(420)}
            style={[styles.inputWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Write what is on your mind..."
                placeholderTextColor={design.colors.mutedInk}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={sendMessage}
              />
              <Pressable onPress={sendMessage} style={({ pressed }) => [styles.sendButton, pressed && styles.pressed]}>
                <Ionicons name="arrow-up" size={18} color={design.colors.textPrimary} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: design.space.xl,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: design.colors.surface,
    borderWidth: 1,
    borderColor: design.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: design.colors.border,
  },
  headerTitle: {
    color: design.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: design.colors.success,
  },
  statusText: {
    color: design.colors.textSecondary,
    fontSize: 12,
  },
  messageList: {
    paddingHorizontal: design.space.xl,
    paddingTop: 12,
    paddingBottom: 14,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: "row",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  botRow: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "rgba(14,165,233,0.8)",
    borderBottomRightRadius: 8,
  },
  botBubble: {
    backgroundColor: design.colors.surface,
    borderWidth: 1,
    borderColor: design.colors.border,
    borderBottomLeftRadius: 8,
  },
  messageText: {
    color: design.colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  inputWrap: {
    paddingHorizontal: design.space.xl,
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: design.colors.border,
    borderRadius: design.radius.lg,
    backgroundColor: design.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: design.colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: design.colors.accentEnd,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
