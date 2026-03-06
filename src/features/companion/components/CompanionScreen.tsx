import { Ionicons } from "@expo/vector-icons";
import { FlashList, FlashListRef, ListRenderItem } from "@shopify/flash-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeInDown,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { AppTheme } from "../../constants/design";
import { useAppState } from "../../contexts/AppStateContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  CompanionMessage,
  CompanionToolCall,
  createCheckinFromCompanion,
  createJournalEntryFromCompanion,
  getCompanionReply,
  getOrCreateConversation,
  loadConversationMessages,
  recordCompanionReminderAction,
  saveConversationMessage,
  prepareCompanionReminderAction,
} from "../../helper/companion";
import { scheduleOneTimeReminder } from "../../helper/notifications";

const EMOTION_CHIPS = [
  { emoji: "🙂", text: "I feel okay" },
  { emoji: "😔", text: "I feel low" },
  { emoji: "😰", text: "I feel anxious" },
  { emoji: "💙", text: "I need support" },
];

const STARTER: CompanionMessage = {
  id: "starter",
  role: "assistant",
  content: "I’m here with you. I’ll listen without judgment. What feels heavy right now?",
  createdAt: new Date().toISOString(),
};

type ChatMessage = CompanionMessage & {
  delivery?: "sending" | "sent" | "failed";
};

const FlashListAny = FlashList as any;

function createMessageId(role: "user" | "assistant") {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseReminderDate(whenText?: string) {
  if (!whenText) return null;
  const raw = whenText.trim().toLowerCase();
  if (!raw) return null;
  const now = new Date();

  const inMatch = raw.match(/\bin\s+(\d+)\s*(minute|minutes|min|hour|hours)\b/);
  if (inMatch) {
    const amount = Number(inMatch[1]);
    const unit = inMatch[2];
    const next = new Date(now);
    if (unit.startsWith("hour")) next.setHours(next.getHours() + amount);
    else next.setMinutes(next.getMinutes() + amount);
    return next;
  }

  const result = new Date(now);
  if (raw.includes("tomorrow")) {
    result.setDate(result.getDate() + 1);
  }
  if (raw.includes("tonight") && !/\d/.test(raw)) {
    result.setHours(20, 0, 0, 0);
    if (result <= now) result.setDate(result.getDate() + 1);
    return result;
  }

  const timeMatch = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!timeMatch) return null;
  const minute = Number(timeMatch[2] ?? 0);
  let hour = Number(timeMatch[1]);
  const meridiem = timeMatch[3];
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  result.setHours(hour, minute, 0, 0);
  if (!raw.includes("tomorrow") && result <= now) result.setDate(result.getDate() + 1);
  return result;
}

function isConfirmation(text: string) {
  return /^(yes|yep|yeah|sure|ok|okay|confirm|do it)\b/i.test(text.trim());
}

function isDecline(text: string) {
  return /^(no|nah|cancel|stop|don't|do not)\b/i.test(text.trim());
}

type ChatBubbleProps = {
  item: ChatMessage;
  isTyping: boolean;
  isSending: boolean;
  onRetry: (messageId: string) => void;
};

function Frosted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

const ChatBubble = memo(function ChatBubble({ item, isTyping, isSending, onRetry }: ChatBubbleProps) {
  const isUser = item.role === "user";
  const canRetry = isUser && item.delivery === "failed" && !isTyping && !isSending;

  const handleRetry = useCallback(() => {
    if (!canRetry) return;
    onRetry(item.id);
  }, [canRetry, item.id, onRetry]);

  return (
    <Animated.View
      entering={FadeInDown.duration(280).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 12 }],
      })}
      style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}
    >
      {!isUser ? (
        <View style={styles.assistantBadge}>
          <Text style={styles.assistantBadgeText}>✦</Text>
        </View>
      ) : null}
      <Pressable
        disabled={!canRetry}
        onPress={handleRetry}
        style={[
          styles.bubbleBase,
          isUser ? styles.userBubble : styles.assistantBubbleWrap,
          item.delivery === "failed" && styles.failedBubble,
        ]}
      >
        {isUser ? (
          <View style={styles.userBubbleFill}>
            <LinearGradient
              colors={["#c8914a", "#e2b06f"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.userBubbleText}>{item.content}</Text>
          </View>
        ) : (
          <Frosted style={styles.assistantBubble}>
            <Text style={styles.assistantBubbleText}>{item.content}</Text>
          </Frosted>
        )}
      </Pressable>
      <View
        style={[
          styles.metaRow,
          item.role === "user" ? styles.metaRowUser : styles.metaRowAssistant,
        ]}
      >
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </Text>
        {isUser ? (
          item.delivery === "sending" ? (
            <ActivityIndicator size="small" color="rgba(226,176,111,0.9)" style={styles.statusIcon} />
          ) : item.delivery === "failed" ? (
            <Ionicons name="refresh" size={12} color="rgba(232,112,112,0.95)" style={styles.statusIcon} />
          ) : (
            <Ionicons name="checkmark-done" size={12} color="rgba(226,176,111,0.9)" style={styles.statusIcon} />
          )
        ) : null}
      </View>
    </Animated.View>
  );
});

function TypingIndicator() {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = (sv: SharedValue<number>, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 400 }),
          ),
          -1,
        ),
      );
    };
    animate(dot1, 0);
    animate(dot2, 160);
    animate(dot3, 320);
  }, [dot1, dot2, dot3]);

  const dot1Style = useAnimatedStyle(() => ({
    opacity: 0.4 + dot1.value * 0.6,
    transform: [{ translateY: -dot1.value * 4 }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    opacity: 0.4 + dot2.value * 0.6,
    transform: [{ translateY: -dot2.value * 4 }],
  }));
  const dot3Style = useAnimatedStyle(() => ({
    opacity: 0.4 + dot3.value * 0.6,
    transform: [{ translateY: -dot3.value * 4 }],
  }));

  return (
    <View style={typingStyles.row}>
      <View style={typingStyles.badge}>
        <Text style={typingStyles.badgeText}>✦</Text>
      </View>
      <View style={typingStyles.bubble}>
        <Animated.View style={[typingStyles.dot, dot1Style]} />
        <Animated.View style={[typingStyles.dot, dot2Style]} />
        <Animated.View style={[typingStyles.dot, dot3Style]} />
      </View>
    </View>
  );
}

export default function CompanionScreen() {
  const { user } = useAuth();
  const { busyActions, acquireActionLock, releaseActionLock } = useAppState();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [syncAvailable, setSyncAvailable] = useState(true);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [supportRisk, setSupportRisk] = useState<"safe" | "caution" | "crisis">("safe");
  const [pendingToolCall, setPendingToolCall] = useState<CompanionToolCall | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ ...STARTER, delivery: "sent" }]);
  const bottomComposerOffset = Math.max(insets.bottom + 82, 96);
  const userName = useMemo(
    () => user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "friend",
    [user?.email],
  );
  const consentKey = useMemo(
    () => (user?.id ? `companion-consent:${user.id}` : "companion-consent:anonymous"),
    [user?.id],
  );
  const isSending = Boolean(busyActions["companion.send"]);
  const isCallingSupport = Boolean(busyActions["companion.callSupport"]);
  const isSavingConsent = Boolean(busyActions["companion.saveConsent"]);
  const sendGlow = useSharedValue(0);

  useEffect(() => {
    const shouldGlow = isInputFocused || input.trim().length > 0;
    if (!shouldGlow) {
      sendGlow.value = withTiming(0, { duration: 180 });
      return;
    }
    sendGlow.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [input, isInputFocused, sendGlow]);

  const sendGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + sendGlow.value * 0.35,
    transform: [{ scale: 1 + sendGlow.value * 0.13 }],
  }));

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!user?.id) {
        setMessages([{ ...STARTER, delivery: "sent" }]);
        setConversationId(null);
        setHasConsent(false);
        setShowConsentModal(true);
        return;
      }

      try {
        const consent = await AsyncStorage.getItem(consentKey);
        if (!mounted) return;
        const allowed = consent === "1";
        setHasConsent(allowed);
        setShowConsentModal(!allowed);
      } catch {
        if (!mounted) return;
        setHasConsent(false);
        setShowConsentModal(true);
      }

      try {
        const id = await getOrCreateConversation(user.id);
        if (!mounted) return;
        setConversationId(id);

        const stored = await loadConversationMessages(id);
        if (!mounted) return;
        setSyncAvailable(true);
        setMessages((prev) => {
          const hasLocalMessages = prev.some((item) => item.id !== STARTER.id);
          if (hasLocalMessages) return prev;
          return stored.length
            ? stored.map((item) => ({ ...item, delivery: "sent" }))
            : [{ ...STARTER, delivery: "sent" }];
        });
      } catch (error) {
        console.warn("Companion persistence unavailable. Falling back to local-only mode:", error);
        if (!mounted) return;
        setSyncAvailable(false);
        setMessages([{ ...STARTER, delivery: "sent" }]);
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [consentKey, user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isTyping]);

  const updateDelivery = (messageId: string, delivery: ChatMessage["delivery"]) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, delivery } : msg)));
  };

  const markMessageDelivered = useCallback((prev: ChatMessage[], messageId: string) => {
    let foundById = false;
    const next = prev.map((msg) => {
      if (msg.id !== messageId) return msg;
      foundById = true;
      return { ...msg, delivery: "sent" as const };
    });
    if (foundById) return next;

    // Fallback: mark the most recent user message stuck in "sending" as sent.
    for (let i = next.length - 1; i >= 0; i -= 1) {
      const current = next[i];
      if (current.role === "user" && current.delivery === "sending") {
        next[i] = { ...current, delivery: "sent" as const };
        break;
      }
    }
    return next;
  }, []);

  const appendAssistantMessage = useCallback(async (content: string) => {
    const assistantMessage: ChatMessage = {
      id: createMessageId("assistant"),
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      delivery: "sent",
    };
    setMessages((prev) => [...prev, assistantMessage]);
    if (syncAvailable && conversationId && user?.id) {
      try {
        await saveConversationMessage({
          conversationId,
          userId: user.id,
          role: "assistant",
          content: assistantMessage.content,
        });
      } catch {
        setSyncAvailable(false);
      }
    }
  }, [conversationId, syncAvailable, user?.id]);

  const executeToolCall = useCallback(async (toolCall: CompanionToolCall) => {
    if (!user?.id) throw new Error("You need to be signed in first.");
    if (toolCall.tool === "create_journal_entry") {
      const content = toolCall.payload.content?.trim() ?? "";
      if (!content) throw new Error("I need journal content first.");
      await createJournalEntryFromCompanion({ userId: user.id, content });
      return "Done. I created that journal entry for you.";
    }

    if (toolCall.tool === "create_checkin") {
      const mood = toolCall.payload.mood?.trim() ?? "";
      if (!mood) throw new Error("I need your mood to log the check-in.");
      await createCheckinFromCompanion({
        userId: user.id,
        mood,
        note: toolCall.payload.note,
      });
      return "Done. I logged your check-in for today.";
    }

    const title = toolCall.payload.title?.trim() || "Companion reminder";
    const when = parseReminderDate(toolCall.payload.whenText);
    if (!when) {
      throw new Error("I couldn't parse the reminder time. Try something like 'tomorrow 8am' or 'in 30 minutes'.");
    }
    await prepareCompanionReminderAction(user.id);
    await scheduleOneTimeReminder({
      title,
      body: "A gentle check-in from Ami.",
      when,
    });
    await recordCompanionReminderAction(user.id, title);
    const timeLabel = when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    return `Done. Reminder set for ${timeLabel}.`;
  }, [user?.id]);

  const sendMessage = useCallback(async (textInput?: string) => {
    const text = (textInput ?? input).trim();
    if (!text || !user?.id || isTyping || isSending || !hasConsent) return;

    const locked = acquireActionLock("companion.send");
    if (!locked) return;

    setInput("");
    setSupportRisk("safe");

    const userMessage: ChatMessage = {
      id: createMessageId("user"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      delivery: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    if (syncAvailable && conversationId) {
      try {
        await saveConversationMessage({
          conversationId,
          userId: user.id,
          role: "user",
          content: text,
        });
      } catch {
        setSyncAvailable(false);
      }
    }

    if (pendingToolCall && (isConfirmation(text) || isDecline(text))) {
      updateDelivery(userMessage.id, "sent");
      try {
        if (isDecline(text)) {
          await appendAssistantMessage("Okay, I won’t do that.");
          setPendingToolCall(null);
        } else {
          const resultMessage = await executeToolCall(pendingToolCall);
          await appendAssistantMessage(resultMessage);
          setPendingToolCall(null);
        }
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String((error as { message: string }).message)
            : "I couldn't complete that action.";
        await appendAssistantMessage(message);
      } finally {
        releaseActionLock("companion.send");
        setIsTyping(false);
      }
      return;
    }

    const recent = [...messages, userMessage];

    try {
      const response = await getCompanionReply({
        userMessage: text,
        recentMessages: recent,
        userName,
        userId: user.id,
      });
      const riskLevel = response.riskLevel ?? (response.isCrisis ? "crisis" : "safe");

      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
        role: "assistant",
        content: response.text,
        createdAt: new Date().toISOString(),
        delivery: "sent",
      };

      setMessages((prev) => [
        ...markMessageDelivered(prev, userMessage.id),
        assistantMessage,
      ]);
      setSupportRisk(riskLevel);
      setAiUnavailable(response.source === "fallback");
      setPendingToolCall(response.toolCall?.requiresConfirmation ? response.toolCall : null);

      if (syncAvailable && conversationId) {
        try {
          await saveConversationMessage({
            conversationId,
            userId: user.id,
            role: "assistant",
            content: assistantMessage.content,
          });
        } catch {
          setSyncAvailable(false);
        }
      }
    } catch {
      updateDelivery(userMessage.id, "failed");
      setAiUnavailable(true);
    } finally {
      releaseActionLock("companion.send");
      setIsTyping(false);
    }
  }, [
    acquireActionLock,
    conversationId,
    hasConsent,
    input,
    isSending,
    isTyping,
    messages,
    releaseActionLock,
    appendAssistantMessage,
    markMessageDelivered,
    syncAvailable,
    pendingToolCall,
    executeToolCall,
    user?.id,
    userName,
  ]);

  const retryMessage = useCallback((messageId: string) => {
    const failed = messages.find((msg) => msg.id === messageId && msg.delivery === "failed");
    if (!failed || isTyping || isSending) return;
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    sendMessage(failed.content);
  }, [isSending, isTyping, messages, sendMessage]);

  const callSupport = async () => {
    if (isCallingSupport) return;
    const locked = acquireActionLock("companion.callSupport");
    if (!locked) return;

    try {
      const canOpen = await Linking.canOpenURL("tel:988");
      if (!canOpen) {
        Alert.alert("Call 988", "Please call or text 988 for immediate support.");
        return;
      }
      await Linking.openURL("tel:988");
    } finally {
      releaseActionLock("companion.callSupport");
    }
  };

  const acceptCompanionConsent = async () => {
    if (isSavingConsent) return;
    const locked = acquireActionLock("companion.saveConsent");
    if (!locked) return;

    try {
      await AsyncStorage.setItem(consentKey, "1");
    } catch {
      // no-op
    } finally {
      releaseActionLock("companion.saveConsent");
    }
    setHasConsent(true);
    setShowConsentModal(false);
  };

  const renderMessage = useCallback<ListRenderItem<ChatMessage>>(
    ({ item }) => (
      <ChatBubble item={item} isTyping={isTyping} isSending={isSending} onRetry={retryMessage} />
    ),
    [isSending, isTyping, retryMessage],
  );

  return (
    <LinearGradient colors={["#0d1b2a", "#122338", "#1b2d42"]} style={styles.screen}>
      <View style={styles.noiseOverlay} />
      <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent"]} style={styles.topVignette} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.42)"]} style={styles.bottomVignette} />

      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 16 : 0}
        >
          <View style={styles.container}>
            <Animated.View entering={FadeInDown.duration(340)} style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Private space</Text>
                <Text style={styles.title}>Companion</Text>
              </View>
              <View style={styles.headerIconWrap}>
                <Ionicons name="heart" size={14} color="#f5cf8a" />
              </View>
            </Animated.View>

            <FlashListAny
              ref={listRef}
              data={messages}
              keyExtractor={(item: ChatMessage) => item.id}
              renderItem={renderMessage}
              estimatedItemSize={80}
              removeClippedSubviews={false}
              maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 20 }}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                listRef.current?.scrollToEnd({ animated: true });
              }}
            />

            {aiUnavailable ? (
              <Frosted style={styles.fallbackBanner}>
                <Ionicons name="cloud-offline-outline" size={13} color="#d4dbe6" />
                <Text style={styles.fallbackText}>AI unavailable, supportive local mode active.</Text>
              </Frosted>
            ) : null}

            {isTyping ? <TypingIndicator /> : null}

            {supportRisk === "crisis" ? (
              <Frosted style={styles.crisisCard}>
                <Text style={styles.crisisTitle}>You deserve immediate support</Text>
                <Text style={styles.crisisBody}>
                  If you might act on harmful thoughts, call emergency services now. In the U.S.,
                  call or text 988.
                </Text>
                <Pressable
                  onPress={callSupport}
                  disabled={isCallingSupport}
                  style={({ pressed }) => [styles.crisisBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.crisisBtnText}>Call 988</Text>
                </Pressable>
              </Frosted>
            ) : (
              <Frosted style={styles.emotionTray}>
                {EMOTION_CHIPS.map((chip) => (
                  <Pressable
                    key={chip.text}
                    onPress={() => sendMessage(chip.text)}
                    disabled={!hasConsent || isTyping || isSending}
                    style={({ pressed }) => [styles.emotionChip, pressed && styles.emojiPressed]}
                  >
                    <Text style={styles.emotionText}>{chip.emoji}</Text>
                  </Pressable>
                ))}
              </Frosted>
            )}

            <View style={[styles.inputShell, { paddingBottom: bottomComposerOffset }]}>
              <Frosted style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={
                    hasConsent ? "Write softly... what is weighing on you?" : "Accept consent to start chatting"
                  }
                  placeholderTextColor="rgba(222,228,238,0.6)"
                  style={[styles.input, !input.trim() && styles.inputPlaceholderLike]}
                  multiline
                  editable={hasConsent}
                />
                <Pressable
                  onPress={() => sendMessage()}
                  disabled={!hasConsent || !input.trim() || isTyping || isSending}
                  style={({ pressed }) => [
                    styles.sendBtnWrap,
                    (!hasConsent || !input.trim() || isTyping || isSending || pressed) && styles.pressed,
                  ]}
                >
                  <Animated.View style={[styles.sendGlow, sendGlowStyle]} />
                  <LinearGradient
                    colors={["#c8914a", "#e2b06f"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendBtn}
                  >
                    <Ionicons name="arrow-up" size={17} color="#271808" />
                  </LinearGradient>
                </Pressable>
              </Frosted>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal visible={showConsentModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <Frosted style={styles.modalCard}>
            <Text style={styles.modalTitle}>Before we start</Text>
            <Text style={styles.modalBody}>
              Companion offers emotional support, not therapy or emergency care. If you are in
              immediate danger, call emergency services. In the U.S., call or text 988.
            </Text>
            <Pressable
              onPress={acceptCompanionConsent}
              disabled={isSavingConsent}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}
            >
              <LinearGradient colors={["#c8914a", "#e2b06f"]} style={styles.modalPrimaryGradient}>
                <Text style={styles.modalPrimaryText}>I understand</Text>
              </LinearGradient>
            </Pressable>
          </Frosted>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 24,
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  noiseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  topVignette: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  bottomVignette: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 170,
  },
  container: {
    flex: 1,
    paddingHorizontal: AppTheme.space.lg,
  },
  header: {
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: "rgba(236,224,204,0.75)",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#f2ebe1",
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 38,
    lineHeight: 42,
  },
  headerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  messageList: {
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 4,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  rowAssistant: {
    justifyContent: "flex-start",
    paddingRight: 48,
  },
  rowUser: {
    justifyContent: "flex-end",
    paddingLeft: 48,
  },
  assistantBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  assistantBadgeText: {
    color: "#e7c68a",
    fontSize: 12,
  },
  bubbleBase: {
    maxWidth: "84%",
    ...shadow,
  },
  assistantBubbleWrap: {
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  assistantBubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantBubbleText: {
    color: "#e8eef8",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0.1,
  },
  userBubble: {
    borderRadius: 20,
    borderBottomRightRadius: 4,
  },
  userBubbleFill: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
    borderRadius: 20,
    borderBottomRightRadius: 4,
    position: "relative",
  },
  userBubbleText: {
    color: "#1a0f00",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: "rgba(232,112,112,0.88)",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginHorizontal: 4,
  },
  metaRowUser: {
    alignSelf: "flex-end",
  },
  metaRowAssistant: {
    alignSelf: "flex-start",
  },
  timestamp: {
    color: "rgba(180,195,215,0.55)",
    fontSize: 10,
    letterSpacing: 0.1,
  },
  statusIcon: {
    marginTop: 1,
  },
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 11,
    paddingVertical: 8,
    overflow: "hidden",
  },
  fallbackText: {
    color: "#d4dbe6",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 11,
  },
  typing: {
    color: "#cad2df",
    fontFamily: AppTheme.fonts.statItalic,
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 4,
  },
  emotionTray: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
  },
  emotionChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  emotionText: {
    fontSize: 18,
  },
  emojiPressed: {
    transform: [{ scale: 1.08 }],
  },
  crisisCard: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(226,176,111,0.45)",
    padding: 12,
    overflow: "hidden",
  },
  crisisTitle: {
    color: "#f8e5ca",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 14,
  },
  crisisBody: {
    marginTop: 6,
    color: "#ded6ca",
    fontFamily: AppTheme.fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  crisisBtn: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#D87755",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
  },
  crisisBtnText: {
    color: "#fff",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 14,
  },
  inputShell: {
    paddingTop: 2,
    backgroundColor: "transparent",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    paddingHorizontal: 13,
    paddingTop: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: "#eef2f8",
    fontFamily: Platform.select({ ios: "Lato", android: "sans-serif" }),
    fontSize: 15,
    lineHeight: 24,
    paddingBottom: 11,
  },
  inputPlaceholderLike: {
    fontStyle: "italic",
  },
  sendBtnWrap: {
    marginBottom: 8,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sendGlow: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(226,176,111,0.52)",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(6,10,16,0.56)",
    justifyContent: "center",
    paddingHorizontal: AppTheme.space.xl,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    padding: AppTheme.space.lg,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "#f2ece4",
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 24,
  },
  modalBody: {
    marginTop: 8,
    color: "#d7deea",
    fontFamily: Platform.select({ ios: "Lato", android: "sans-serif" }),
    fontSize: 13,
    lineHeight: 20,
  },
  modalPrimaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  modalPrimaryGradient: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryText: {
    color: "#2f1f0f",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.82,
  },
});

const typingStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
    marginLeft: 2,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#e7c68a",
    fontSize: 12,
  },
  bubble: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#a0b4c8",
  },
});
