import { QueryClient } from "@tanstack/react-query";

export function userQueryKeys(userId: string) {
  return {
    journalEntries: ["journal-entries", userId] as const,
    moodTrends: ["mood-trends", userId] as const,
  };
}

export async function invalidateUserQueries(
  queryClient: QueryClient,
  userId: string,
  refetchType: "active" | "inactive" | "all" | "none" = "none",
) {
  const keys = userQueryKeys(userId);
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: keys.journalEntries,
      refetchType,
    }),
    queryClient.invalidateQueries({
      queryKey: keys.moodTrends,
      refetchType,
    }),
  ]);
}
