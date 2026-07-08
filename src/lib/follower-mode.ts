import { getBroadcasterChatSettings, upsertBroadcasterChatSettings } from "@/lib/local-store";
import { getChatSettingsByBroadcasterId } from "@/lib/twitch";

export const FOLLOWER_ONLY_CACHE_TTL_MS = 15 * 60 * 1000;
export const FOLLOWER_ONLY_LOOKUP_CONCURRENCY = 8;

const FOLLOWER_ONLY_PREFETCH_LIMIT = 200;

function isFreshChatSettings(checkedAt: string) {
  const checkedAtTime = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtTime)) {
    return false;
  }

  return Date.now() - checkedAtTime <= FOLLOWER_ONLY_CACHE_TTL_MS;
}

export async function getFollowerModeForBroadcasterId(broadcasterId: string) {
  const cached = getBroadcasterChatSettings(broadcasterId);
  if (cached && isFreshChatSettings(cached.checkedAt)) {
    return Boolean(cached.followerMode);
  }

  try {
    const settings = await getChatSettingsByBroadcasterId(broadcasterId);
    if (!settings) {
      return null;
    }

    const record = upsertBroadcasterChatSettings({
      broadcasterId,
      followerMode: settings.follower_mode,
      followerModeDuration: settings.follower_mode_duration ?? null
    });

    return Boolean(record.followerMode);
  } catch {
    return null;
  }
}

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
) {
  const results = new Array<R>(values.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const nextIndex = index;
      index += 1;

      if (nextIndex >= values.length) {
        return;
      }

      results[nextIndex] = await mapper(values[nextIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function prefetchFollowerModes(broadcasterIds: string[]) {
  const unique = Array.from(new Set(broadcasterIds.filter(Boolean))).slice(0, FOLLOWER_ONLY_PREFETCH_LIMIT);
  if (unique.length === 0) {
    return;
  }

  await mapWithConcurrency(unique, FOLLOWER_ONLY_LOOKUP_CONCURRENCY, getFollowerModeForBroadcasterId);
}
