import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";

export function userQueryKeys(userId: string) {
  return {
    journalEntries: queryKeys.journal(userId),
    moodTrends: queryKeys.moodTrends(userId, "ALL"),
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
