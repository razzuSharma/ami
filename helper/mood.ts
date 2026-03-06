export type MoodLabel = "Anxious" | "Tired" | "Calm" | "Happy" | "Good" | "Excited" | "Low" | "Flat" | "Great";

const MOOD_SCORE_BY_LABEL: Record<MoodLabel, number> = {
  Anxious: 1,
  Low: 1,
  Tired: 2,
  Flat: 2,
  Calm: 3,
  Happy: 4,
  Good: 4,
  Excited: 5,
  Great: 5,
};

const MOOD_EMOJI_BY_SCORE: Record<number, string> = {
  1: "😰",
  2: "😔",
  3: "😌",
  4: "🙂",
  5: "🤩",
};

const MOOD_LABEL_BY_SCORE: Record<number, MoodLabel> = {
  1: "Anxious",
  2: "Tired",
  3: "Calm",
  4: "Good",
  5: "Excited",
};

export function moodScoreFromValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    if (value <= 1.5) return 1;
    if (value <= 2.5) return 2;
    if (value <= 3.5) return 3;
    if (value <= 4.5) return 4;
    return 5;
  }

  if (typeof value === "string") {
    const label = value.trim() as MoodLabel;
    return MOOD_SCORE_BY_LABEL[label] ?? 3;
  }

  return 3;
}

export function moodLabelFromValue(value: number | string | null | undefined): MoodLabel {
  const score = moodScoreFromValue(value);
  return MOOD_LABEL_BY_SCORE[score] ?? "Calm";
}

export function moodEmojiFromValue(value: number | string | null | undefined) {
  const score = moodScoreFromValue(value);
  return MOOD_EMOJI_BY_SCORE[score] ?? "😌";
}

export function moodColorFromValue(value: number | string | null | undefined) {
  const score = moodScoreFromValue(value);
  if (score <= 1) return "#A98CFF";
  if (score <= 2) return "#F0947A";
  if (score <= 3) return "#5BD7C1";
  if (score <= 4) return "#D8B886";
  return "#E2B06F";
}
