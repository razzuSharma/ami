import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList, FlashListRef, ListRenderItem } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import Animated, {
  FadeInDown,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
  prepareCompanionReminderAction,
  recordCompanionReminderAction,
  saveConversationMessage,
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
  content:
    "I’m here with you. I’ll listen without judgment. What feels heavy right now?",
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
  const relativeMatch = raw.match(
    /\b(?:in|after)\s+(\d+)\s*(second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs|day|days)\b/,
  );
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const next = new Date(now);
    if (unit.startsWith("day")) next.setDate(next.getDate() + amount);
    else if (unit.startsWith("hour") || unit.startsWith("hr")) next.setHours(next.getHours() + amount);
    else if (unit.startsWith("sec")) next.setSeconds(next.getSeconds() + amount);
    else next.setMinutes(next.getMinutes() + amount);
    return next;
  }

  const result = new Date(now);
  const hasTomorrow = /\btomorrow\b/.test(raw);
  if (hasTomorrow) {
    result.setDate(result.getDate() + 1);
  }

  if ((raw.includes("tonight") || raw.includes("this evening")) && !/\d/.test(raw)) {
    result.setHours(20, 0, 0, 0);
    if (!hasTomorrow && result <= now) result.setDate(result.getDate() + 1);
    return result;
  }
  if (raw.includes("this morning") && !/\d/.test(raw)) {
    result.setHours(9, 0, 0, 0);
    if (!hasTomorrow && result <= now) result.setDate(result.getDate() + 1);
    return result;
  }

  const weekdayMatch = raw.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const weekdayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const target = weekdayMap[weekdayMatch[2]];
    const current = result.getDay();
    let delta = (target - current + 7) % 7;
    if (weekdayMatch[1] || delta === 0) delta += 7;
    result.setDate(result.getDate() + delta);
  }

  const timeMatch = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!timeMatch) {
    if (weekdayMatch) {
      result.setHours(9, 0, 0, 0);
      return result;
    }
    return null;
  }
  const minute = Number(timeMatch[2] ?? 0);
  let hour = Number(timeMatch[1]);
  const meridiem = timeMatch[3];
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  result.setHours(hour, minute, 0, 0);
  if (!hasTomorrow && !weekdayMatch && result <= now) result.setDate(result.getDate() + 1);
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

const ChatBubble = memo(function ChatBubble({
  item,
  isTyping,
  isSending,
  onRetry,
}: ChatBubbleProps) {
  const isUser = item.role === "user";
  const canRetry =
    isUser && item.delivery === "failed" && !isTyping && !isSending;

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
        <Text
          style={[
            styles.timestamp,
            { alignSelf: item.role === "user" ? "flex-end" : "flex-start" },
          ]}
        >
          {new Date(item.createdAt).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </Text>
        {isUser ? (
          item.delivery === "sending" ? (
            <ActivityIndicator
              size="small"
              color="rgba(226,176,111,0.9)"
              style={styles.statusIcon}
            />
          ) : item.delivery === "failed" ? (
            <Ionicons
              name="refresh"
              size={12}
              color="rgba(232,112,112,0.95)"
              style={styles.statusIcon}
            />
          ) : (
            <Ionicons
              name="checkmark-done"
              size={12}
              color="rgba(226,176,111,0.9)"
              style={styles.statusIcon}
            />
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [companionName, setCompanionName] = useState("Companion");
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [quickReminderText, setQuickReminderText] = useState("");
  const [quickReminderMinutes, setQuickReminderMinutes] = useState(30);
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [syncAvailable, setSyncAvailable] = useState(true);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [supportRisk, setSupportRisk] = useState<"safe" | "caution" | "crisis">(
    "safe",
  );
  const [pendingToolCall, setPendingToolCall] =
    useState<CompanionToolCall | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { ...STARTER, delivery: "sent" },
  ]);
  const bottomComposerOffset = Math.max(insets.bottom + 56, 56);
  const composerBottomPadding =
    Platform.OS === "android" && keyboardHeight > 0 ? 10 : bottomComposerOffset;
  const userName = useMemo(
    () => user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "friend",
    [user?.email],
  );
  const displayCompanionName = useMemo(() => {
    const trimmed = companionName.trim() || "Companion";
    return trimmed.length > 18 ? `${trimmed.slice(0, 18)}…` : trimmed;
  }, [companionName]);
  const consentKey = useMemo(
    () =>
      user?.id ? `companion-consent:${user.id}` : "companion-consent:anonymous",
    [user?.id],
  );
  const remindersEnabledKey = useMemo(
    () => (user?.id ? `reminders-enabled:${user.id}` : "reminders-enabled:anonymous"),
    [user?.id],
  );
  const isSending = Boolean(busyActions["companion.send"]);
  const isCallingSupport = Boolean(busyActions["companion.callSupport"]);
  const isSavingConsent = Boolean(busyActions["companion.saveConsent"]);
  const isSchedulingReminder = Boolean(busyActions["companion.reminder"]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadCompanionName = async () => {
        if (!user?.id) {
          if (active) setCompanionName("Companion");
          return;
        }
        const stored = await AsyncStorage.getItem(`companion-name:${user.id}`);
        if (active) setCompanionName(stored?.trim() || "Companion");
      };
      void loadCompanionName();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

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
        console.warn(
          "Companion persistence unavailable. Falling back to local-only mode:",
          error,
        );
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
    if (Platform.OS !== "android") return undefined;
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isTyping]);

  const updateDelivery = (
    messageId: string,
    delivery: ChatMessage["delivery"],
  ) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, delivery } : msg)),
    );
  };

  const markMessageDelivered = useCallback(
    (prev: ChatMessage[], messageId: string) => {
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
    },
    [],
  );

  const appendAssistantMessage = useCallback(
    async (content: string) => {
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
    },
    [conversationId, syncAvailable, user?.id],
  );

  const canScheduleReminders = useCallback(async () => {
    const enabled = await AsyncStorage.getItem(remindersEnabledKey);
    if (enabled === "0") {
      Alert.alert(
        "Reminders are off",
        "Enable reminders from settings/onboarding to schedule one-time reminders.",
      );
      return false;
    }
    return true;
  }, [remindersEnabledKey]);

  const executeToolCall = useCallback(
    async (toolCall: CompanionToolCall) => {
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
        throw new Error(
          "I couldn't parse that. Try: 'in 30 minutes', 'after 2 hours', 'this evening', or 'next monday 7pm'.",
        );
      }
      const remindersAllowed = await canScheduleReminders();
      if (!remindersAllowed) {
        throw new Error("Reminders are disabled in your settings.");
      }
      await prepareCompanionReminderAction(user.id);
      await scheduleOneTimeReminder({
        title,
        body: `A gentle check-in from ${companionName}.`,
        when,
      });
      await recordCompanionReminderAction(user.id, title);
      const timeLabel = when.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `Done. Reminder set for ${timeLabel}.`;
    },
    [canScheduleReminders, companionName, user?.id],
  );

  const sendMessage = useCallback(
    async (textInput?: string) => {
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
        const riskLevel =
          response.riskLevel ?? (response.isCrisis ? "crisis" : "safe");

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
        setPendingToolCall(
          response.toolCall?.requiresConfirmation ? response.toolCall : null,
        );

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
    },
    [
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
    ],
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      const failed = messages.find(
        (msg) => msg.id === messageId && msg.delivery === "failed",
      );
      if (!failed || isTyping || isSending) return;
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      sendMessage(failed.content);
    },
    [isSending, isTyping, messages, sendMessage],
  );

  const scheduleQuickReminder = useCallback(async () => {
    if (!user?.id || isSchedulingReminder) return;
    const title = quickReminderText.trim();
    if (!title) {
      Alert.alert("Add a reminder", "Tell me what you want to be reminded about.");
      return;
    }
    const remindersAllowed = await canScheduleReminders();
    if (!remindersAllowed) return;

    const locked = acquireActionLock("companion.reminder");
    if (!locked) return;

    try {
      await prepareCompanionReminderAction(user.id);
      const when = new Date(Date.now() + quickReminderMinutes * 60 * 1000);
      await scheduleOneTimeReminder({
        title,
        body: `A gentle reminder from ${companionName}.`,
        when,
      });
      await recordCompanionReminderAction(user.id, title);
      setShowReminderModal(false);
      setQuickReminderText("");
      const assistantMessage: ChatMessage = {
        id: createMessageId("assistant"),
        role: "assistant",
        content: `Done. I will remind you in ${quickReminderMinutes} minutes.`,
        createdAt: new Date().toISOString(),
        delivery: "sent",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not schedule reminder.";
      Alert.alert("Reminder failed", message);
    } finally {
      releaseActionLock("companion.reminder");
    }
  }, [
    acquireActionLock,
    canScheduleReminders,
    companionName,
    isSchedulingReminder,
    quickReminderMinutes,
    quickReminderText,
    releaseActionLock,
    user?.id,
  ]);

  const callSupport = async () => {
    if (isCallingSupport) return;
    const locked = acquireActionLock("companion.callSupport");
    if (!locked) return;

    try {
      const canOpen = await Linking.canOpenURL("tel:988");
      if (!canOpen) {
        Alert.alert(
          "Call 988",
          "Please call or text 988 for immediate support.",
        );
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
      <ChatBubble
        item={item}
        isTyping={isTyping}
        isSending={isSending}
        onRetry={retryMessage}
      />
    ),
    [isSending, isTyping, retryMessage],
  );

  return (
    <LinearGradient
      colors={["#0d1b2a", "#122338", "#1b2d42"]}
      style={styles.screen}
    >
      <View style={styles.noiseOverlay} />
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "transparent"]}
        style={styles.topVignette}
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.42)"]}
        style={styles.bottomVignette}
      />

      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 16 : 0}
        >
          <View style={styles.container}>
            <Animated.View
              entering={FadeInDown.duration(340)}
              style={styles.header}
            >
              <View style={styles.headerTitleWrap}>
                <Text style={styles.eyebrow}>Private space</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {displayCompanionName}
                </Text>
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
              maintainVisibleContentPosition={{
                autoscrollToBottomThreshold: 20,
              }}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                listRef.current?.scrollToEnd({ animated: true });
              }}
            />

            {aiUnavailable ? (
              <Frosted style={styles.fallbackBanner}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={13}
                  color="#d4dbe6"
                />
                <Text style={styles.fallbackText}>
                  AI unavailable, supportive local mode active.
                </Text>
              </Frosted>
            ) : null}

            {isTyping ? <TypingIndicator /> : null}

            {supportRisk === "crisis" ? (
              <Frosted style={styles.crisisCard}>
                <Text style={styles.crisisTitle}>
                  You deserve immediate support
                </Text>
                <Text style={styles.crisisBody}>
                  If you might act on harmful thoughts, call emergency services
                  now. In the U.S., call or text 988.
                </Text>
                <Pressable
                  onPress={callSupport}
                  disabled={isCallingSupport}
                  style={({ pressed }) => [
                    styles.crisisBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.crisisBtnText}>Call 988</Text>
                </Pressable>
              </Frosted>
            ) : (
              <View style={styles.quickActionsRow}>
                <Frosted style={styles.emotionTray}>
                  {EMOTION_CHIPS.map((chip) => (
                    <Pressable
                      key={chip.text}
                      onPress={() => sendMessage(chip.text)}
                      disabled={!hasConsent || isTyping || isSending}
                      style={({ pressed }) => [
                        styles.emotionChip,
                        pressed && styles.emojiPressed,
                      ]}
                    >
                      <Text style={styles.emotionText}>{chip.emoji}</Text>
                    </Pressable>
                  ))}
                </Frosted>
                <Pressable
                  onPress={() => setShowReminderModal(true)}
                  disabled={!hasConsent || isTyping || isSending}
                  style={({ pressed }) => [
                    styles.reminderShortcut,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="timer-outline" size={18} color="#EFD9B8" />
                </Pressable>
              </View>
            )}

            <View
              style={[
                styles.inputShell,
                { paddingBottom: composerBottomPadding },
              ]}
            >
              <Frosted style={styles.inputRow}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  placeholder={
                    hasConsent
                      ? "Write softly... what is weighing on you?"
                      : "Accept consent to start chatting"
                  }
                  placeholderTextColor="rgba(222,228,238,0.6)"
                  style={[
                    styles.input,
                    !input.trim() && styles.inputPlaceholderLike,
                    isInputFocused && styles.inputFocused,
                  ]}
                  multiline
                  editable={hasConsent}
                />
                <Pressable
                  onPress={() => sendMessage()}
                  disabled={
                    !hasConsent || !input.trim() || isTyping || isSending
                  }
                  style={({ pressed }) => [
                    styles.sendBtnWrap,
                    (!hasConsent ||
                      !input.trim() ||
                      isTyping ||
                      isSending ||
                      pressed) &&
                      styles.pressed,
                  ]}
                >
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

      <Modal
        visible={showConsentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <Frosted style={styles.modalCard}>
            <Text style={styles.modalTitle}>Before we start</Text>
            <Text style={styles.modalBody}>
              Companion offers emotional support, not therapy or emergency care.
              If you are in immediate danger, call emergency services. In the
              U.S., call or text 988.
            </Text>
            <Pressable
              onPress={acceptCompanionConsent}
              disabled={isSavingConsent}
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                pressed && styles.pressed,
              ]}
            >
              <LinearGradient
                colors={["#c8914a", "#e2b06f"]}
                style={styles.modalPrimaryGradient}
              >
                <Text style={styles.modalPrimaryText}>I understand</Text>
              </LinearGradient>
            </Pressable>
          </Frosted>
        </View>
      </Modal>
      <Modal
        visible={showReminderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.quickModalOverlay}>
          <Frosted style={styles.quickModalCard}>
            <Text style={styles.quickModalTitle}>Quick reminder</Text>
            <Text style={styles.quickModalBody}>
              Set a one-time reminder so you do not forget.
            </Text>
            <TextInput
              value={quickReminderText}
              onChangeText={setQuickReminderText}
              placeholder="What should I remind you about?"
              placeholderTextColor="rgba(222,228,238,0.6)"
              style={styles.reminderInput}
            />
            <View style={styles.quickDurationRow}>
              {[15, 30, 60].map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => setQuickReminderMinutes(minutes)}
                  style={[
                    styles.quickDurationChip,
                    quickReminderMinutes === minutes &&
                      styles.quickDurationChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.quickDurationText,
                      quickReminderMinutes === minutes &&
                        styles.quickDurationTextActive,
                    ]}
                  >
                    {minutes}m
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setShowReminderModal(false)}
                style={styles.modalGhostButton}
                disabled={isSchedulingReminder}
              >
                <Text style={styles.modalGhostButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void scheduleQuickReminder();
                }}
                style={[styles.modalPrimaryBtn, styles.modalPrimaryBtnInline]}
                disabled={isSchedulingReminder}
              >
                <LinearGradient
                  colors={["#c8914a", "#e2b06f"]}
                  style={styles.modalPrimaryGradient}
                >
                  <Text style={styles.modalPrimaryText}>
                    {isSchedulingReminder ? "Setting..." : "Set reminder"}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
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
  headerTitleWrap: {
    flex: 1,
    maxWidth: "80%",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: "rgba(226,176,111,0.5)",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    color: "#f2ebe1",
    fontFamily: AppTheme.fonts.serifDisplay,
    fontSize: 34,
    lineHeight: 38,
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
    paddingBottom: 8,
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
    fontSize: 10,
    color: "rgba(180,195,215,0.5)",
    marginTop: 2,
    marginHorizontal: 6,
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
    marginBottom: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
  },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  reminderShortcut: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: "#eef2f8",
    fontFamily: Platform.select({ ios: "Lato", android: "sans-serif" }),
    fontSize: 15,
    lineHeight: 24,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 8,
  },
  inputFocused: {
    borderColor: "rgba(200,145,74,0.28)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  inputPlaceholderLike: {
    fontStyle: "italic",
  },
  sendBtnWrap: {
    marginBottom: 0,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  quickModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(4,8,14,0.78)",
    justifyContent: "center",
    paddingHorizontal: AppTheme.space.lg,
  },
  quickModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    padding: 16,
    backgroundColor: "#14243A",
  },
  quickModalTitle: {
    color: "#F0EDE8",
    fontFamily: AppTheme.fonts.bodyBold,
    fontSize: 24,
  },
  quickModalBody: {
    marginTop: 8,
    color: "#C9D4E3",
    fontFamily: Platform.select({ ios: "Lato", android: "sans-serif" }),
    fontSize: 13,
    lineHeight: 19,
  },
  reminderInput: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "#eef2f8",
    fontFamily: Platform.select({ ios: "Lato", android: "sans-serif" }),
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickDurationRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  quickDurationChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickDurationChipActive: {
    borderColor: "rgba(200,145,74,0.55)",
    backgroundColor: "rgba(200,145,74,0.18)",
  },
  quickDurationText: {
    color: "#d7deea",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 12,
  },
  quickDurationTextActive: {
    color: "#f2e2c6",
  },
  modalActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  modalGhostButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostButtonText: {
    color: "#d7deea",
    fontFamily: AppTheme.fonts.bodyMedium,
    fontSize: 14,
  },
  modalPrimaryBtn: {
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  modalPrimaryBtnInline: {
    flex: 1,
    marginTop: 0,
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
