export type MoodLabel = "Anxious" | "Tired" | "Calm" | "Happy" | "Good" | "Excited";
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  mood: MoodLabel;
  note?: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  mood_tag?: MoodLabel;
  ai_reflection?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  risk_level?: "low" | "medium" | "high" | "crisis";
  created_at: string;
  status?: "sending" | "sent" | "failed";
}

export interface ConversationMeta {
  id: string;
  user_id: string;
  created_at: string;
  last_message_at: string;
}

export interface UserContextFact {
  id: string;
  user_id: string;
  fact: string;
  source: "chat" | "journal" | "checkin";
  confidence: number;
  last_seen_at: string;
  created_at: string;
}
