import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Message = {
  id: string;
  text: string;
  user: "bot" | "user";
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<Message>>(null);
  const [input, setInput] = useState("");

  const initialMessages = useMemo<Message[]>(
    () => [
      { id: "1", text: "Good evening! 🌙\nHow are you feeling?", user: "bot" },
      {
        id: "2",
        text: "Honestly, a bit drained. It was intense.",
        user: "user",
      },
      { id: "3", text: "I understand. Take a deep breath. 🌿", user: "bot" },
    ],
    [],
  );

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

  const headerHeight = 64;
  const keyboardVerticalOffset =
    Platform.OS === "ios" ? insets.top + headerHeight : 0;

  return (
    <LinearGradient
      colors={["#1a0f2e", "#2d1b4e", "#1a1625"]}
      className="flex-1"
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* Header */}
          <View className="px-4 pt-2 pb-5 flex-row items-center justify-between">
            <Pressable className="w-11 h-11 rounded-full border border-white/15 bg-white/8 items-center justify-center">
              <Ionicons name="chevron-back" size={22} color="#faf8f5" />
            </Pressable>
            <View className="flex-1 flex-row items-center ml-4">
              <View className="relative">
                <View
                  style={{
                    position: "absolute",
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: "rgba(167,139,250,0.25)",
                    top: -4,
                    left: -4,
                  }}
                />
                <View className="w-12 h-12 rounded-full overflow-hidden bg-purple-700/50 border border-white/15">
                  <Image
                    source={require("../../assets/images/image-ami.png")}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                </View>
              </View>
              <View className="ml-3">
                <Text className="text-[#faf8f5] text-xl font-semibold">
                  Companion
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-400/90 mr-2" />
                  <Text className="text-purple-200/90 text-xs">Online</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Messages Container */}
          <View style={{ flex: 1 }}>
            <FlatList
              style={{ flex: 1 }}
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isUser = item.user === "user";
                return (
                  <View
                    className={`mb-4 ${isUser ? "self-end" : "self-start"}`}
                  >
                    <View
                      className={`px-5 py-4 max-w-[85%] rounded-[32px] ${
                        isUser
                          ? "rounded-br-md"
                          : "rounded-bl-md bg-white/12 border border-white/5"
                      }`}
                      style={
                        isUser
                          ? {
                              backgroundColor: "rgba(124,58,237,0.85)",
                              shadowColor: "#7c3aed",
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.2,
                              shadowRadius: 12,
                              elevation: 4,
                            }
                          : undefined
                      }
                    >
                      <Text
                        className="text-[#faf8f5] text-lg leading-[1.65]"
                        style={{ lineHeight: 26 }}
                      >
                        {item.text}
                      </Text>
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 18,
                paddingBottom: 88,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
            {/* Input Bar */}
            <View
              style={{
                paddingHorizontal: 18,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingTop: 12,
              }}
            >
              <View
                className="flex-row items-center rounded-[28px] px-5 py-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  shadowColor: "#1a1625",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  elevation: 2,
                }}
              >
                <TextInput
                  className="flex-1 text-[#faf8f5] text-base px-2 min-h-[48px]"
                  placeholder="What's on your mind?"
                  placeholderTextColor="#c4b5fd"
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={sendMessage}
                  multiline={false}
                />
                <Pressable
                  onPress={sendMessage}
                  className="ml-2 w-11 h-11 rounded-full overflow-hidden"
                >
                  <LinearGradient
                    colors={["#c084fc", "#a78bfa", "#7c3aed"]}
                    className="w-full h-full items-center justify-center"
                  >
                    <Ionicons name="arrow-up" size={22} color="#faf8f5" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
