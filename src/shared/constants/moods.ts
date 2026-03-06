import { MoodLabel, MoodScore } from "../types";

export const moodScoreMap: Record<MoodLabel, MoodScore> = {
  Anxious: 1,
  Tired: 2,
  Calm: 3,
  Happy: 4,
  Good: 4,
  Excited: 5,
};

export const moodEmojiMap: Record<MoodLabel, string> = {
  Anxious: "😰",
  Tired: "😔",
  Calm: "😌",
  Happy: "😊",
  Good: "🙂",
  Excited: "🤩",
};

export const moodLabelByScore: Record<MoodScore, MoodLabel> = {
  1: "Anxious",
  2: "Tired",
  3: "Calm",
  4: "Good",
  5: "Excited",
};

export function normalizeMoodScore(value: number): MoodScore {
  if (value <= 1.5) return 1;
  if (value <= 2.5) return 2;
  if (value <= 3.5) return 3;
  if (value <= 4.5) return 4;
  return 5;
}

export function moodFromScore(score: number): MoodLabel {
  return moodLabelByScore[normalizeMoodScore(score)];
}
