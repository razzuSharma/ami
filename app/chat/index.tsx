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
  View
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
  
  const initialMessages = useMemo<Message[]>(() => [
    { id: "1", text: "Good evening! 🌙\nHow are you feeling?", user: "bot" },
    { id: "2", text: "Honestly, a bit drained. It was intense.", user: "user" },
    { id: "3", text: "I understand. Take a deep breath. 🌿", user: "bot" },
  ], []);

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMessage: Message = { id: Date.now().toString(), text: input.trim(), user: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
  };

  return (
    <LinearGradient colors={["#130820", "#0a0714", "#08060f"]} className="flex-1">
  <View style={{ flex: 1, paddingTop: insets.top }}>
    
    {/* Header */}
    <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
      <Pressable className="w-10 h-10 rounded-full border border-white/20 bg-white/10 items-center justify-center">
        <Ionicons name="chevron-back" size={22} color="#f5f3ff" />
      </Pressable>
      <View className="flex-1 flex-row items-center ml-3">
        <View className="w-12 h-12 rounded-full overflow-hidden bg-purple-800/60 border border-white/10">
          <Image
            source={require("../../assets/images/image-ami.png")}
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>
        <View className="ml-3">
          <Text className="text-white text-xl font-semibold">Companion</Text>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-green-400 mr-2" />
            <Text className="text-purple-200 text-xs">Online</Text>
          </View>
        </View>
      </View>
    </View>

    {/* Keyboard Avoiding Container */}
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 50 : 0}
    >
      <View className="flex-1 justify-end">
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isUser = item.user === "user";
            return (
              <View className={`mb-3 ${isUser ? "self-end" : "self-start"}`}>
                <View className={`px-5 py-4 max-w-[85%] rounded-[28px] ${isUser ? "bg-purple-600 rounded-br-sm" : "bg-white/10 rounded-bl-sm"}`}>
                  <Text className="text-white text-lg leading-7">{item.text}</Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, flexGrow: 1, justifyContent: "flex-end" }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />

        {/* Input Bar */}
        <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 8), marginTop: 6 }}>
          <View
            className="flex-row items-center rounded-full px-4 py-1.5"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <TextInput
              className="flex-1 text-white text-base px-2 min-h-[45px]"
              placeholder="I think I just need to..."
              placeholderTextColor="#c4b5fd"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={sendMessage}
              multiline={false}
            />
            <Pressable onPress={sendMessage} className="ml-2 w-10 h-10 rounded-full overflow-hidden">
              <LinearGradient colors={["#d946ef", "#a855f7"]} className="w-full h-full items-center justify-center">
                <Ionicons name="arrow-up" size={22} color="white" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </View>
</LinearGradient>
  );
}