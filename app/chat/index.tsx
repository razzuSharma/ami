import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ChatBubble from "../../components/ChatBubble";
import TypingIndicator from "../../components/TypingIndicator";

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    { id: "1", text: "Hi! I’m here for you 😊", user: "bot" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  // Send message function
  const sendMessage = () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: input,
      user: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "That’s interesting! 😄",
          user: "bot",
        },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      {/* Sticky header */}
      <LinearGradient
        colors={["#1f2937", "#111827"]}
        className="px-4 py-3 flex-row items-center border-b border-gray-700"
      >
        <View className="w-10 h-10 bg-blue-500 rounded-full mr-3" />
        <View>
          <Text className="text-white font-semibold text-lg">Companion</Text>
          <Text className="text-gray-400 text-sm">Active now</Text>
          
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Chat card */}
        <LinearGradient
          colors={["rgba(30,30,30,0.8)", "rgba(45,45,45,0.8)"]}
          className="flex-1 m-4 rounded-3xl p-4 shadow-2xl overflow-hidden"
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          />

          {isTyping && (
            <View className="px-2 pb-2">
              <TypingIndicator />
            </View>
          )}
        </LinearGradient>

        {/* Input bar */}
        <View className="absolute bottom-4 left-4 right-4 flex-row items-center bg-gray-800/90 border border-gray-700 rounded-3xl px-4 py-2 shadow-lg">
          {/* Emoji */}
          <TouchableOpacity
            onPress={() => setInput((prev) => prev + "😊")}
            className="mr-2"
          >
            <Text className="text-xl">😊</Text>
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            className="flex-1 bg-gray-700 rounded-2xl px-4 py-2 text-white text-base mr-3"
            placeholder="Say something..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
          />

          {/* Send button */}
          <TouchableOpacity
            className="bg-blue-500 px-4 py-2 rounded-2xl justify-center items-center shadow-md"
            onPress={sendMessage}
          >
            <Text className="text-white font-semibold text-base">Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
