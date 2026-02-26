type ProfileStats = {
  streak: number;
  checkins: number;
  journal: number;
};

export type ProfileCacheValue = {
  userId: string;
  profileName: string;
  stats: ProfileStats;
  journalPreview: string;
  moodPreview: string;
  loadedAt: number;
};

let profileCache: ProfileCacheValue | null = null;

const PROFILE_CACHE_TTL_MS = 2 * 60 * 1000;

export function getProfileCache(userId: string | null | undefined) {
  if (!userId || !profileCache) return null;
  if (profileCache.userId !== userId) return null;
  return profileCache;
}

export function isProfileCacheFresh(cache: ProfileCacheValue | null) {
  if (!cache) return false;
  return Date.now() - cache.loadedAt < PROFILE_CACHE_TTL_MS;
}

export function setProfileCache(next: ProfileCacheValue) {
  profileCache = next;
}

export function clearProfileCache() {
  profileCache = null;
}
