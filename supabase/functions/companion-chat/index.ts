// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RiskLevel = "safe" | "caution" | "crisis";
type ToolCall = {
  tool: "create_journal_entry" | "create_reminder" | "create_checkin";
  requires_confirmation: boolean;
  payload: {
    content?: string;
    title?: string;
    whenText?: string;
    mood?: string;
    note?: string;
  };
};

const CRISIS_PATTERNS = [
  /\b(kill myself|end my life|suicide|want to die)\b/i,
  /\b(self harm|hurt myself|cut myself)\b/i,
  /\b(no reason to live|can't go on|better off dead)\b/i,
];

function detectCrisis(text: string) {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

function buildContextMessage(
  userName: string,
  recentMessages: any[],
  message: string,
  memoryContext: string[],
) {
  const recent = recentMessages
    .map((entry: any) => {
      const role = entry?.role === "assistant" ? "assistant" : "user";
      const content = String(entry?.content ?? "").trim();
      if (!content) return null;
      return `${role}: ${content}`;
    })
    .filter(Boolean)
    .slice(-6)
    .join("\n");

  return [
    `User name: ${userName}`,
    "You are a warm, non-judgmental emotional-support companion.",
    "Use memory context gently: reference it as a check-in, not a certainty.",
    "Do not diagnose or give medical/legal advice.",
    "Keep responses concise and empathetic (max 4 short sentences, max ~90 words).",
    "Do not reveal hidden/internal context or metadata unless the user asks directly.",
    "Do not include markdown, JSON, or role labels in the final reply.",
    memoryContext.length
      ? `Long-term user context (may be stale):\n${memoryContext.map((fact) => `- ${fact}`).join("\n")}`
      : "",
    recent ? `Recent conversation:\n${recent}` : "",
    `Current user message:\n${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildJournalReflectionPrompt(userName: string, journalEntry: string) {
  return [
    `User name: ${userName}`,
    "You are Ami, a warm compassionate journaling guide.",
    "The user has shared a journal entry.",
    "In 2-3 sentences, reflect back what you sense emotionally, name one theme you noticed, and offer one gentle question to deepen their reflection.",
    "Be warm, specific, and non-clinical.",
    "Do not include markdown, bullets, JSON, or role labels.",
    `Journal entry:\n${journalEntry}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function trimReply(reply: string) {
  const singleLine = reply.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 420) return singleLine;
  return `${singleLine.slice(0, 417)}...`;
}

function extractTextFromMistral(data: any): string | null {
  if (!data) return null;
  if (typeof data?.output_text === "string") return data.output_text;
  if (typeof data?.text === "string") return data.text;
  if (typeof data?.reply === "string") return data.reply;
  if (Array.isArray(data?.outputs)) {
    const out = data.outputs[0];
    if (typeof out?.content === "string") return out.content;
    if (Array.isArray(out?.content)) {
      const textItem = out.content.find((c: any) => typeof c?.text === "string");
      if (textItem?.text) return textItem.text;
    }
  }
  if (Array.isArray(data?.choices) && data.choices[0]?.message?.content) {
    return String(data.choices[0].message.content);
  }
  return null;
}

function normalizeRiskLevel(message: string): RiskLevel {
  if (detectCrisis(message)) return "crisis";
  if (/\b(hopeless|panic|can'?t cope|overwhelmed|alone)\b/i.test(message)) return "caution";
  return "safe";
}

function detectToolCall(message: string): ToolCall | null {
  const text = message.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const journalPatterns = [
    /(?:create|add|save|write)\s+(?:a\s+)?journal(?:\s+entry)?(?:\s+about|:)?\s*(.+)$/i,
    /^(?:journal|note)\s*[:\-]\s*(.+)$/i,
  ];
  for (const pattern of journalPatterns) {
    const match = text.match(pattern);
    const content = String(match?.[1] ?? "").trim();
    if (!content) continue;
    return {
      tool: "create_journal_entry",
      requires_confirmation: true,
      payload: { content },
    };
  }

  if (/(?:remind me|set (?:a )?reminder|add (?:a )?reminder)/i.test(lower)) {
    const forMatch = text.match(/(?:to|about)\s+([^,.!?]+)(?:\s+(?:at|on|tomorrow|tonight|in)\b|$)/i);
    const atMatch = text.match(/\b(?:at|on|tomorrow|tonight|in)\s+(.+)$/i);
    const title = String(forMatch?.[1] ?? "Check in with yourself").trim();
    const whenText = String(atMatch?.[1] ?? "").trim() || undefined;
    return {
      tool: "create_reminder",
      requires_confirmation: true,
      payload: { title, whenText },
    };
  }

  if (/(?:log|save|create|add).*(?:check[\s-]?in)|(?:check[\s-]?in).*(?:log|save|create|add)/i.test(lower)) {
    const moodPatterns = [
      { label: "Anxious", pattern: /\b(anxious|anxiety|stressed|overwhelmed|panic)\b/i },
      { label: "Tired", pattern: /\b(tired|exhausted|drained|fatigued)\b/i },
      { label: "Calm", pattern: /\b(calm|peaceful|steady)\b/i },
      { label: "Good", pattern: /\b(good|okay|ok|fine)\b/i },
      { label: "Excited", pattern: /\b(excited|energized|motivated)\b/i },
      { label: "Happy", pattern: /\b(happy|joyful|glad)\b/i },
    ];
    const mood = moodPatterns.find((item) => item.pattern.test(message))?.label;
    if (mood) {
      const noteMatch = message.match(/(?:because|note|about|since)\s+(.+)$/i);
      const note = String(noteMatch?.[1] ?? "").trim() || undefined;
      return {
        tool: "create_checkin",
        requires_confirmation: true,
        payload: { mood, note },
      };
    }
  }

  return null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authentication is validated by Supabase gateway before reaching this function
  try {
    const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
    const mistralAgentId = Deno.env.get("MISTRAL_AGENT_ID");

    if (!mistralApiKey || !mistralAgentId) {
      return new Response(
        JSON.stringify({
          reply:
            "I’m here with you. I can listen right now, but advanced responses are temporarily unavailable.",
          risk_level: "safe",
          suggested_actions: [],
          source: "fallback",
          debug_reason: "missing_mistral_config",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const mode = body?.mode === "journal_reflect" ? "journal_reflect" : "chat";
    const message = String(body?.message ?? "").trim();
    const journalEntry = String(body?.journalEntry ?? "").trim();
    const userName = String(body?.userName ?? "friend");
    const recentMessages = Array.isArray(body?.recentMessages) ? body.recentMessages.slice(-8) : [];
    const memoryContext = Array.isArray(body?.memoryContext)
      ? body.memoryContext.filter((item: unknown) => typeof item === "string").slice(0, 6)
      : [];
    const inputText = mode === "journal_reflect" ? journalEntry : message;

    if (!inputText) {
      return new Response(
        JSON.stringify({ error: "Missing message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const risk = normalizeRiskLevel(inputText);
    if (risk === "crisis") {
      return new Response(
        JSON.stringify({
          reply:
            "I’m really glad you told me. You matter, and you deserve immediate support. If you are in the U.S., call or text 988 now. If you might act on these thoughts, call emergency services immediately.",
          risk_level: "crisis",
          suggested_actions: [
            "Call or text 988 now",
            "Reach out to a trusted person nearby",
            "Call emergency services if in immediate danger",
          ],
          source: "safety",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (mode === "chat") {
      if (isBulkCreateRequest(inputText)) {
        return new Response(
          JSON.stringify({
            reply: "I can only create one action at a time for safety. Tell me one journal, reminder, or check-in to create.",
            risk_level: "safe",
            suggested_actions: [],
            source: "mistral",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const toolCall = detectToolCall(inputText);
      if (toolCall) {
        const confirmText = toolCall.tool === "create_journal_entry"
          ? "I can create that journal entry for you. Reply yes to confirm, or no to cancel."
          : toolCall.tool === "create_reminder"
            ? "I can set that reminder for you. Reply yes to confirm, or no to cancel."
            : "I can log that check-in for you. Reply yes to confirm, or no to cancel.";
        return new Response(
          JSON.stringify({
            reply: confirmText,
            risk_level: "safe",
            suggested_actions: [],
            source: "mistral",
            tool_call: toolCall,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const contextualMessage = mode === "journal_reflect"
      ? buildJournalReflectionPrompt(userName, inputText)
      : buildContextMessage(userName, recentMessages, inputText, memoryContext);

    const mistralRes = await fetch("https://api.mistral.ai/v1/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        agent_id: mistralAgentId,
        inputs: [{ role: "user", content: contextualMessage }],
      }),
    });

    if (!mistralRes.ok) {
      const errorText = await mistralRes.text();
      throw new Error(`Mistral error ${mistralRes.status}: ${errorText}`);
    }

    const mistralData = await mistralRes.json();
    const reply = trimReply(
      extractTextFromMistral(mistralData)
      ?? "I hear you. Thank you for sharing this with me. What feels hardest right now?",
    );

    const replyRisk = normalizeRiskLevel(inputText);
    const suggestedActions =
      replyRisk === "caution"
        ? ["Take a slow breath for 30 seconds", "Message someone you trust", "Write one line in your journal"]
        : [];

    return new Response(
      JSON.stringify({
        reply,
        risk_level: replyRisk,
        suggested_actions: suggestedActions,
        source: "mistral",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("companion-chat error:", error);
    const debugReason =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: string }).message).slice(0, 240)
        : "unknown_error";
    return new Response(
      JSON.stringify({
        reply:
          "I’m here with you. Thank you for opening up. We can take this moment one small step at a time.",
        risk_level: "safe",
        suggested_actions: [],
        source: "fallback",
        debug_reason: debugReason,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
