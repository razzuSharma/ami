import { supabase } from "./supabaseClient";
import { invokeEdgeFunction } from "@/shared/lib/edgeFunction";

export type CompanionRole = "user" | "assistant";

export type CompanionMessage = {
  id: string;
  role: CompanionRole;
  content: string;
  createdAt: string;
};

export type CompanionReply = {
  text: string;
  isCrisis: boolean;
  riskLevel?: "safe" | "caution" | "crisis";
  suggestedActions?: string[];
  source?: "mistral" | "fallback" | "safety";
  toolCall?: CompanionToolCall;
};

export type UserContextMemory = {
  id: string;
  fact: string;
  confidence: number;
  lastSeenAt: string;
};

export type CompanionToolCall = {
  tool: "create_journal_entry" | "create_reminder" | "create_checkin";
  requiresConfirmation: boolean;
  payload: {
    content?: string;
    title?: string;
    whenText?: string;
    mood?: string;
    note?: string;
  };
};

type CompanionActionType = "journal" | "reminder" | "checkin";

const COMPANION_ACTION_LIMITS: Record<CompanionActionType, number> = {
  journal: 5,
  reminder: 8,
  checkin: 10,
};

const CRISIS_PATTERNS = [
  /\b(kill myself|end my life|suicide|want to die)\b/i,
  /\b(self harm|hurt myself|cut myself)\b/i,
  /\b(no reason to live|can't go on|better off dead)\b/i,
];

const REFLECTIONS = [
  "That sounds really heavy. Thank you for sharing it with me.",
  "I hear you. What you are carrying matters.",
  "You are not weak for feeling this way. It makes sense after what you have been through.",
  "I am here with you. We can take this one small step at a time.",
];

const QUESTIONS = [
  "What part feels the hardest right now?",
  "Do you want to tell me what happened today?",
  "Would it help to name one feeling in your body right now?",
  "What would feel 1% gentler in this moment?",
];

function randomFrom(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

function normalizeFact(raw: string) {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= 160) return compact;
  return `${compact.slice(0, 157)}...`;
}

function uniqueFacts(facts: string[]) {
  return Array.from(new Set(facts.map((fact) => fact.toLowerCase()))).map((lower) => {
    const match = facts.find((item) => item.toLowerCase() === lower);
    return match ?? "";
  }).filter(Boolean);
}

function detectToolCallFromText(message: string): CompanionToolCall | undefined {
  const text = message.trim();
  if (!text) return undefined;

  const journalPatterns: RegExp[] = [
    /(?:create|add|save|write)\s+(?:a\s+)?journal(?:\s+entry)?(?:\s+about|:)?\s*(.+)$/i,
    /^(?:journal|note)\s*[:\-]\s*(.+)$/i,
  ];
  for (const pattern of journalPatterns) {
    const match = text.match(pattern);
    const content = String(match?.[1] ?? "").trim();
    if (!content) continue;
    return {
      tool: "create_journal_entry",
      requiresConfirmation: true,
      payload: { content },
    };
  }

  if (/(?:remind me|set (?:a )?reminder|add (?:a )?reminder)/i.test(text)) {
    const forMatch = text.match(/(?:to|about)\s+([^,.!?]+)(?:\s+(?:at|on|tomorrow|tonight|in)\b|$)/i);
    const atMatch = text.match(/\b(?:at|on|tomorrow|tonight|in)\s+(.+)$/i);
    return {
      tool: "create_reminder",
      requiresConfirmation: true,
      payload: {
        title: String(forMatch?.[1] ?? "Check in with yourself").trim(),
        whenText: String(atMatch?.[1] ?? "").trim() || undefined,
      },
    };
  }

  if (/(?:log|save|create|add).*(?:check[\s-]?in)|(?:check[\s-]?in).*(?:log|save|create|add)/i.test(text)) {
    const moodPatterns: Array<{ label: string; pattern: RegExp }> = [
      { label: "Anxious", pattern: /\b(anxious|anxiety|stressed|overwhelmed|panic)\b/i },
      { label: "Tired", pattern: /\b(tired|exhausted|drained|fatigued)\b/i },
      { label: "Calm", pattern: /\b(calm|peaceful|steady)\b/i },
      { label: "Good", pattern: /\b(good|okay|ok|fine)\b/i },
      { label: "Excited", pattern: /\b(excited|energized|motivated)\b/i },
      { label: "Happy", pattern: /\b(happy|joyful|glad)\b/i },
    ];
    const mood = moodPatterns.find((item) => item.pattern.test(text))?.label;
    const noteMatch = text.match(/(?:because|note|about|since)\s+(.+)$/i);
    const note = String(noteMatch?.[1] ?? "").trim() || undefined;
    if (mood) {
      return {
        tool: "create_checkin",
        requiresConfirmation: true,
        payload: { mood, note },
      };
    }
  }

  return undefined;
}

function isBulkCreateRequest(message: string) {
  const text = message.toLowerCase();
  const hasCreate = /(create|add|save|write|log|set)/.test(text);
  const hasTarget = /(journal|reminder|check[\s-]?in)/.test(text);
  if (!hasCreate || !hasTarget) return false;
  const numberMatch = text.match(/\b(\d+)\b/);
  const count = numberMatch ? Number(numberMatch[1]) : 0;
  return count >= 2 || /\b(many|bulk|multiple|all)\b/.test(text);
}

function extractCandidateFacts(message: string) {
  const text = message.trim().replace(/\s+/g, " ");
  if (!text) return [] as string[];
  const candidates: string[] = [];

  const patterns: RegExp[] = [
    /(?:i am|i'm|ive been|i have been)\s+([^.!?]{8,120})/i,
    /(?:struggling with|dealing with|worried about|stressed about)\s+([^.!?]{8,120})/i,
    /(?:at work|in school|with my family|in my relationship)\s+([^.!?]{8,120})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const fact = normalizeFact(match[0]);
    if (fact) candidates.push(fact);
  }

  if (candidates.length === 0 && text.length >= 18 && text.length <= 120) {
    candidates.push(normalizeFact(text));
  }

  return uniqueFacts(candidates).slice(0, 3);
}

export function detectCrisis(text: string) {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildLocalCompanionReply(userText: string): CompanionReply {
  if (isBulkCreateRequest(userText)) {
    return {
      isCrisis: false,
      riskLevel: "safe",
      source: "fallback",
      text: "I can only create one action at a time for safety. Tell me one journal, reminder, or check-in to create.",
    };
  }

  const toolCall = detectToolCallFromText(userText);
  if (toolCall) {
    return {
      isCrisis: false,
      riskLevel: "safe",
      source: "fallback",
      toolCall,
      text:
        toolCall.tool === "create_journal_entry"
          ? "I can create that journal entry for you. Reply yes to confirm, or no to cancel."
          : toolCall.tool === "create_reminder"
            ? "I can set that reminder for you. Reply yes to confirm, or no to cancel."
            : "I can log that check-in for you. Reply yes to confirm, or no to cancel.",
    };
  }

  if (detectCrisis(userText)) {
    return {
      isCrisis: true,
      riskLevel: "crisis",
      suggestedActions: ["Call or text 988 now", "Contact a trusted person", "Call emergency services if in immediate danger"],
      source: "fallback",
      text:
        "I’m really glad you told me. You deserve immediate support right now. If you’re in the U.S., call or text 988 now. If you might act on these thoughts, call emergency services immediately.",
    };
  }

  const lower = userText.toLowerCase();
  const groundedPrompt = /\b(anxious|panic|overwhelm|can't breathe)\b/.test(lower)
    ? "Want to do a 30-second grounding with me? Name 3 things you can see, 2 you can feel, and 1 you can hear."
    : randomFrom(QUESTIONS);

  return {
    isCrisis: false,
    riskLevel: "safe",
    source: "fallback",
    text: `${randomFrom(REFLECTIONS)} ${groundedPrompt}`,
  };
}

export async function getOrCreateConversation(userId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("companion_conversations")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("companion_conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (createError) throw createError;
  return created.id as string;
}

export async function loadConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("companion_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .limit(100)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    role: row.role as CompanionRole,
    content: String(row.content ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  })) as CompanionMessage[];
}

export async function saveConversationMessage(params: {
  conversationId: string;
  userId: string;
  role: CompanionRole;
  content: string;
}) {
  const { error } = await supabase.from("companion_messages").insert({
    conversation_id: params.conversationId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
  });
  if (error) throw error;
}

export async function loadUserContextFacts(userId: string, limit = 5): Promise<UserContextMemory[]> {
  const { data, error } = await supabase
    .from("user_context")
    .select("id,fact,confidence,last_seen_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    fact: String(row.fact ?? ""),
    confidence: Number(row.confidence ?? 0.6),
    lastSeenAt: String(row.last_seen_at ?? new Date().toISOString()),
  }));
}

export async function forgetUserContextFact(userId: string, factId: string) {
  const { error } = await supabase
    .from("user_context")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", factId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function clearUserContextFacts(userId: string) {
  const { error } = await supabase
    .from("user_context")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw error;
}

async function upsertUserContextFacts(userId: string, message: string) {
  const facts = extractCandidateFacts(message);
  if (facts.length === 0) return;
  const rows = facts.map((fact) => ({
    user_id: userId,
    fact,
    source: "chat",
    confidence: 0.72,
    is_active: true,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("user_context").upsert(rows, {
    onConflict: "user_id,fact",
  });
  if (error) {
    console.warn("Failed to store companion memory:", error.message);
  }
}

type FunctionReplyPayload = {
  reply?: unknown;
  risk_level?: unknown;
  suggested_actions?: unknown;
  source?: unknown;
  text?: unknown;
  message?: unknown;
  tool_call?: unknown;
};

type ExtractedFunctionReply =
  | string
  | {
    text: string;
    riskLevel: "safe" | "caution" | "crisis";
    suggestedActions: string[];
    source: "mistral" | "fallback" | "safety";
    toolCall?: CompanionToolCall;
  }
  | null;

function parseToolCall(value: unknown): CompanionToolCall | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    tool?: unknown;
    requires_confirmation?: unknown;
    requiresConfirmation?: unknown;
    payload?: unknown;
  };
  if (
    raw.tool !== "create_journal_entry"
    && raw.tool !== "create_reminder"
    && raw.tool !== "create_checkin"
  ) return undefined;
  const payload = raw.payload && typeof raw.payload === "object"
    ? (raw.payload as {
      content?: unknown;
      title?: unknown;
      whenText?: unknown;
      mood?: unknown;
      note?: unknown;
    })
    : undefined;
  return {
    tool: raw.tool,
    requiresConfirmation: Boolean(raw.requires_confirmation ?? raw.requiresConfirmation ?? true),
    payload: {
      content: typeof payload?.content === "string" ? payload.content.trim() : undefined,
      title: typeof payload?.title === "string" ? payload.title.trim() : undefined,
      whenText: typeof payload?.whenText === "string" ? payload.whenText.trim() : undefined,
      mood: typeof payload?.mood === "string" ? payload.mood.trim() : undefined,
      note: typeof payload?.note === "string" ? payload.note.trim() : undefined,
    },
  };
}

function extractFunctionReply(payload: unknown): ExtractedFunctionReply {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") {
    const candidate = payload as FunctionReplyPayload;
    if (typeof candidate.reply === "string") {
      const riskLevel =
        candidate.risk_level === "crisis" || candidate.risk_level === "caution"
          ? candidate.risk_level
          : "safe";
      const source =
        candidate.source === "mistral" || candidate.source === "safety"
          ? candidate.source
          : "fallback";
      const suggestedActions = Array.isArray(candidate.suggested_actions)
        ? candidate.suggested_actions.filter((item): item is string => typeof item === "string")
        : [];

      return {
        text: candidate.reply,
        riskLevel: riskLevel as "safe" | "caution" | "crisis",
        suggestedActions,
        source: source as "mistral" | "fallback" | "safety",
        toolCall: parseToolCall(candidate.tool_call),
      };
    }

    if (typeof candidate.text === "string") return candidate.text;
    if (typeof candidate.message === "string") return candidate.message;
  }

  return null;
}

export async function getCompanionReply(params: {
  userMessage: string;
  recentMessages: CompanionMessage[];
  userName?: string;
  userId?: string;
}): Promise<CompanionReply> {
  const local = buildLocalCompanionReply(params.userMessage);

  try {
    const memoryContext = params.userId
      ? (await loadUserContextFacts(params.userId, 4)).map((item) => item.fact)
      : [];
    const data = await invokeEdgeFunction<unknown>("companion-chat", {
      message: params.userMessage,
      recentMessages: params.recentMessages.slice(-8),
      userName: params.userName || "friend",
      memoryContext,
    });
    console.log("[Companion] edge raw response:", data);
    if (params.userId) {
      await upsertUserContextFacts(params.userId, params.userMessage);
    }
    const functionReply = extractFunctionReply(data);
    if (!functionReply) return local;
    if (typeof functionReply === "string") {
      return {
        text: functionReply,
        isCrisis: local.isCrisis,
        riskLevel: local.isCrisis ? "crisis" : "safe",
        source: "fallback",
      };
    }

    return {
      text: functionReply.text,
      isCrisis: functionReply.riskLevel === "crisis" || local.isCrisis,
      riskLevel: functionReply.riskLevel,
      suggestedActions: functionReply.suggestedActions,
      source: functionReply.source,
      toolCall: functionReply.toolCall,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Session invalid after key rotation")) {
      console.error("[Companion] Auth error - session invalid, please sign in again:", message);
    } else if (message.includes("401") || message.includes("Unauthorized")) {
      console.error("[Companion] Auth error - unauthorized edge call:", message);
    } else {
      console.warn("[Companion] Edge function unavailable, using local fallback:", message);
    }
    return local;
  }
}

export async function getJournalReflection(params: {
  entryText: string;
  userName?: string;
}): Promise<string> {
  const fallback =
    "I hear how much this moment is holding for you. A theme I notice is your effort to stay present while carrying a lot. What would feeling 1% more supported look like tonight?";

  try {
    const data = await invokeEdgeFunction<unknown>("companion-chat", {
      mode: "journal_reflect",
      journalEntry: params.entryText,
      userName: params.userName || "friend",
    });
    console.log("[Companion] edge raw response:", data);

    const parsed = extractFunctionReply(data);
    if (!parsed) return fallback;
    if (typeof parsed === "string") return parsed;
    return parsed.text || fallback;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Session invalid after key rotation")) {
      console.error("[Companion] Auth error - session invalid, please sign in again:", message);
    } else if (message.includes("401") || message.includes("Unauthorized")) {
      console.error("[Companion] Auth error - unauthorized edge call:", message);
    } else {
      console.warn("[Companion] Edge function unavailable, using local fallback:", message);
    }
    return fallback;
  }
}

export async function createJournalEntryFromCompanion(params: {
  userId: string;
  content: string;
}) {
  await assertCompanionActionAllowed(params.userId, "journal");
  const compact = params.content.replace(/\s+/g, " ").trim();
  if (!compact) throw new Error("Journal content is empty.");
  if (compact.length > 3000) {
    throw new Error("Journal content is too long. Keep it under 3000 characters.");
  }
  const title = compact.length <= 80
    ? compact
    : compact.slice(0, 80).replace(/\s+\S*$/, "") + "…";
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: params.userId,
      title,
      content: compact,
    })
    .select("id,created_at")
    .single();
  if (error) throw new Error(error.message);
  const result = {
    id: String(data.id),
    createdAt: String(data.created_at),
  };
  await recordCompanionAction(params.userId, "journal", compact.slice(0, 180));
  return result;
}

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function moodScoreFromLabel(label: string) {
  const lower = label.toLowerCase();
  if (lower === "anxious") return 1;
  if (lower === "tired") return 2;
  if (lower === "calm") return 3;
  if (lower === "happy" || lower === "good") return 4;
  if (lower === "excited") return 5;
  return null;
}

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

async function countCompanionActionsToday(userId: string, action: CompanionActionType) {
  const { count, error } = await supabase
    .from("companion_action_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", startOfTodayIso());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function recordCompanionAction(userId: string, action: CompanionActionType, details?: string) {
  const { error } = await supabase.from("companion_action_logs").insert({
    user_id: userId,
    action,
    details: details?.slice(0, 180) || null,
  });
  if (error) {
    console.warn("Failed to record companion action:", error.message);
  }
}

export async function assertCompanionActionAllowed(userId: string, action: CompanionActionType) {
  const todayCount = await countCompanionActionsToday(userId, action);
  const limit = COMPANION_ACTION_LIMITS[action];
  if (todayCount >= limit) {
    throw new Error(`Daily limit reached for ${action} actions (${limit}/day).`);
  }
}

export async function prepareCompanionReminderAction(userId: string) {
  await assertCompanionActionAllowed(userId, "reminder");
}

export async function recordCompanionReminderAction(userId: string, title: string) {
  await recordCompanionAction(userId, "reminder", title);
}

export async function createCheckinFromCompanion(params: {
  userId: string;
  mood: string;
  note?: string;
}) {
  await assertCompanionActionAllowed(params.userId, "checkin");
  const mood = moodScoreFromLabel(params.mood);
  if (!mood) throw new Error("I need a valid mood for check-in.");
  const today = toDateKey(new Date());
  const existing = await supabase
    .from("daily_checkins")
    .select("id,date")
    .eq("user_id", params.userId)
    .eq("date", today)
    .maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") {
    throw new Error(existing.error.message);
  }

  const payload = {
    mood,
    notes: params.note?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (existing.data?.id) {
    const updated = await supabase
      .from("daily_checkins")
      .update(payload)
      .eq("id", existing.data.id)
      .eq("user_id", params.userId)
      .select("id,date")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    const result = { id: String(updated.data.id), date: String(updated.data.date) };
    await recordCompanionAction(params.userId, "checkin", `${params.mood}: ${params.note ?? ""}`);
    return result;
  }

  const inserted = await supabase
    .from("daily_checkins")
    .insert({
      user_id: params.userId,
      date: today,
      ...payload,
    })
    .select("id,date")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  const result = {
    id: String(inserted.data.id),
    date: String(inserted.data.date),
  };
  await recordCompanionAction(params.userId, "checkin", `${params.mood}: ${params.note ?? ""}`);
  return result;
}
