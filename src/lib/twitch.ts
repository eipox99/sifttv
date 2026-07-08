import { env, hasTwitchClientCredentials } from "@/lib/env";
import { sleep } from "@/lib/formatters";

const TWITCH_API_BASE = "https://api.twitch.tv/helix";
const TWITCH_OAUTH_BASE = "https://id.twitch.tv/oauth2";

type TwitchPagination = {
  cursor?: string;
};

type TwitchResponse<T> = {
  data: T[];
  pagination?: TwitchPagination;
};

export type TwitchCategory = {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id: string;
};

export type TwitchStream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tag_ids?: string[];
  tags?: string[];
  is_mature: boolean;
};

export type TwitchSearchChannel = {
  id: string;
  broadcaster_login: string;
  display_name: string;
  game_id: string;
  game_name: string;
  title: string;
  thumbnail_url: string;
  is_live: boolean;
  started_at: string;
  tags: string[];
};

export type TwitchFollowedChannel = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  followed_at: string;
};

export type TwitchChatSettings = {
  broadcaster_id: string;
  broadcaster_login?: string;
  broadcaster_name?: string;
  follower_mode: boolean;
  follower_mode_duration?: number | null;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let appTokenCache: TokenCache | null = null;
let appTokenPromise: Promise<string> | null = null;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const DEFAULT_CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 500;

function readCache<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.value as T;
}

function writeCache(key: string, value: unknown, ttlMs: number) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) {
      responseCache.delete(oldestKey);
    }
  }

  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function requireTwitchCredentials() {
  if (!hasTwitchClientCredentials()) {
    throw new Error("Missing Twitch client credentials.");
  }
}

async function requestTwitchToken(
  params: URLSearchParams
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  requireTwitchCredentials();

  const response = await fetch(`${TWITCH_OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error(`Twitch token request failed with status ${response.status}.`);
  }

  return response.json();
}

export async function getAppAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (appTokenCache && appTokenCache.expiresAt > now + 60) {
    return appTokenCache.accessToken;
  }

  if (appTokenPromise) {
    return appTokenPromise;
  }

  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID ?? "",
    client_secret: env.TWITCH_CLIENT_SECRET ?? "",
    grant_type: "client_credentials"
  });

  appTokenPromise = requestTwitchToken(body)
    .then((token) => {
      appTokenCache = {
        accessToken: token.access_token,
        expiresAt: now + token.expires_in
      };
      return token.access_token;
    })
    .finally(() => {
      appTokenPromise = null;
    });

  return appTokenPromise;
}

export async function refreshAccessTokenFromRefreshToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID ?? "",
    client_secret: env.TWITCH_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const refreshed = await requestTwitchToken(body);

  return {
    accessToken: refreshed.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    refreshToken: refreshed.refresh_token
  };
}

type ApiRequestOptions = {
  token?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  retryOnRateLimit?: boolean;
  cacheTtlMs?: number;
};

async function twitchApiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  requireTwitchCredentials();

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const url = `${TWITCH_API_BASE}${path}${query.size > 0 ? `?${query.toString()}` : ""}`;

  const cacheable = !options.token && options.cacheTtlMs !== undefined && options.cacheTtlMs > 0;

  if (cacheable) {
    const cached = readCache<T>(url);
    if (cached !== null) {
      return cached;
    }

    const inFlight = inFlightRequests.get(url);
    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const performRequest = async (): Promise<T> => {
    const token = options.token ?? (await getAppAccessToken());
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": env.TWITCH_CLIENT_ID ?? ""
      },
      cache: "no-store"
    });

    if (response.status === 429 && options.retryOnRateLimit !== false) {
      const reset = response.headers.get("Ratelimit-Reset");
      const waitSeconds = reset ? Math.max(Number(reset) - Math.floor(Date.now() / 1000), 1) : 2;
      await sleep(waitSeconds * 1000);
      return twitchApiRequest<T>(path, options);
    }

    if (!response.ok) {
      const message = await response.text();
      console.error(`Twitch API ${path} failed with ${response.status}: ${message}`);
      throw new Error(`Twitch API request failed (status ${response.status}).`);
    }

    const remaining = response.headers.get("Ratelimit-Remaining");
    const reset = response.headers.get("Ratelimit-Reset");
    if (remaining === "0" && reset) {
      const waitSeconds = Math.max(Number(reset) - Math.floor(Date.now() / 1000), 1);
      await sleep(waitSeconds * 1000);
    }

    return response.json() as Promise<T>;
  };

  if (!cacheable) {
    return performRequest();
  }

  const request = performRequest()
    .then((value) => {
      writeCache(url, value, options.cacheTtlMs as number);
      return value;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, request);
  return request;
}

export async function getTopCategories(cursor?: string) {
  return twitchApiRequest<TwitchResponse<TwitchCategory>>("/games/top", {
    cacheTtlMs: 60_000,
    query: {
      first: 30,
      after: cursor
    }
  });
}

export async function searchCategories(query: string, cursor?: string) {
  return twitchApiRequest<TwitchResponse<TwitchCategory>>("/search/categories", {
    cacheTtlMs: 30_000,
    query: {
      query,
      first: 30,
      after: cursor
    }
  });
}

export async function searchChannels(query: string, cursor?: string, liveOnly = true) {
  return twitchApiRequest<TwitchResponse<TwitchSearchChannel>>("/search/channels", {
    cacheTtlMs: 20_000,
    query: {
      query,
      first: 30,
      after: cursor,
      live_only: liveOnly
    }
  });
}

export async function getGamesByIds(ids: string[]) {
  const query = new URLSearchParams();
  for (const id of ids) {
    query.append("id", id);
  }

  return twitchApiRequest<TwitchResponse<TwitchCategory>>(`/games?${query.toString()}`, {
    cacheTtlMs: 5 * 60_000,
    query: {}
  });
}

export async function getStreamsByCategory(input: {
  categoryId: string;
  language?: string | null;
  cursor?: string;
  token?: string;
  limit?: number;
}) {
  return twitchApiRequest<TwitchResponse<TwitchStream>>("/streams", {
    token: input.token,
    cacheTtlMs: 15_000,
    query: {
      game_id: input.categoryId,
      language: input.language,
      first: input.limit ?? 100,
      after: input.cursor
    }
  });
}

export async function getStreamByUserLogin(login: string) {
  const response = await twitchApiRequest<TwitchResponse<TwitchStream>>("/streams", {
    cacheTtlMs: 20_000,
    query: {
      user_login: login,
      first: 1
    }
  });

  return response.data[0] ?? null;
}

export async function getStreamsByUserIds(userIds: string[], token?: string) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) {
    return [] as TwitchStream[];
  }

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) {
    chunks.push(unique.slice(i, i + 100));
  }

  const responses = await Promise.all(
    chunks.map((chunk) => {
      const query = new URLSearchParams();
      for (const id of chunk) {
        query.append("user_id", id);
      }
      query.set("first", "100");

      return twitchApiRequest<TwitchResponse<TwitchStream>>(`/streams?${query.toString()}`, {
        token,
        cacheTtlMs: 15_000,
        query: {}
      });
    })
  );

  return responses.flatMap((response) => response.data);
}

export async function getFollowedLiveStreams(userId: string, token: string, cursor?: string) {
  return twitchApiRequest<TwitchResponse<TwitchStream>>("/streams/followed", {
    token,
    query: {
      user_id: userId,
      first: 100,
      after: cursor
    }
  });
}

const FOLLOWED_PAGE_CAP = 10;

export async function getAllFollowedLiveStreams(userId: string, token: string) {
  const streams: TwitchStream[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const response = await getFollowedLiveStreams(userId, token, cursor);
    streams.push(...response.data);
    cursor = response.pagination?.cursor;
    pages += 1;
  } while (cursor && pages < FOLLOWED_PAGE_CAP);

  return streams;
}

export async function getAllFollowedChannels(userId: string, token: string) {
  const channels: TwitchFollowedChannel[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const response = await twitchApiRequest<TwitchResponse<TwitchFollowedChannel>>("/channels/followed", {
      token,
      query: {
        user_id: userId,
        first: 100,
        after: cursor
      }
    });
    channels.push(...response.data);
    cursor = response.pagination?.cursor;
    pages += 1;
  } while (cursor && pages < FOLLOWED_PAGE_CAP);

  return channels;
}

export async function getChatSettingsByBroadcasterId(broadcasterId: string, token?: string) {
  const response = await twitchApiRequest<TwitchResponse<TwitchChatSettings>>("/chat/settings", {
    token,
    query: {
      broadcaster_id: broadcasterId
    }
  });

  return response.data[0] ?? null;
}

export type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

const profileImageCache = new Map<string, { url: string; expiresAt: number }>();
let pendingAvatarBatch: Array<{ login: string; resolve: (url: string | null) => void; reject: (err: Error) => void }> = [];
let avatarBatchTimer: ReturnType<typeof setTimeout> | null = null;

async function flushAvatarBatch() {
  const batch = pendingAvatarBatch;
  pendingAvatarBatch = [];
  avatarBatchTimer = null;

  const uniqueLogins = [...new Set(batch.map((p) => p.login))];

  try {
    const query = new URLSearchParams();
    for (const login of uniqueLogins) {
      query.append("login", login);
    }

    const response = await twitchApiRequest<TwitchResponse<TwitchUser>>(`/users?${query.toString()}`, { query: {} });
    const urlMap = new Map<string, string>();
    for (const user of response.data) {
      urlMap.set(user.login, user.profile_image_url);
    }

    const now = Date.now();
    for (const p of batch) {
      const url = urlMap.get(p.login) ?? null;
      if (url) {
        profileImageCache.set(p.login, { url, expiresAt: now + 10 * 60 * 1000 });
      }
      p.resolve(url);
    }
  } catch (err) {
    for (const p of batch) {
      p.reject(err instanceof Error ? err : new Error("Failed to fetch profile image."));
    }
  }
}

export async function getProfileImageUrl(login: string): Promise<string | null> {
  const cached = profileImageCache.get(login);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  return new Promise<string | null>((resolve, reject) => {
    pendingAvatarBatch.push({ login, resolve, reject });
    if (!avatarBatchTimer) {
      avatarBatchTimer = setTimeout(flushAvatarBatch, 50);
    }
  });
}
