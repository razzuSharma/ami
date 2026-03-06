export const queryKeys = {
  profile: (userId: string) => ["profile", userId] as const,
  profileDashboard: (userId: string) => ["profile-dashboard", userId] as const,
  checkIns: (userId: string) => ["checkIns", userId] as const,
  checkInToday: (userId: string, day: string) => ["checkIns", userId, "today", day] as const,
  checkInsRecent: (userId: string) => ["checkIns", userId, "recent"] as const,
  checkInsRange: (userId: string, range: string) => ["checkIns", userId, range] as const,
  journal: (userId: string) => ["journal", userId] as const,
  journalEntry: (entryId: string) => ["journal", "entry", entryId] as const,
  conversation: (convId: string) => ["conversation", convId] as const,
  messages: (convId: string) => ["messages", convId] as const,
  userContext: (userId: string) => ["userContext", userId] as const,
  moodTrends: (userId: string, range: string) => ["moodTrends", userId, range] as const,
};
