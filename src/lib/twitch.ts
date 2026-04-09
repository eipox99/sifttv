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

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let appTokenCache: TokenCache | null = null;

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

  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID ?? "",
    client_secret: env.TWITCH_CLIENT_SECRET ?? "",
    grant_type: "client_credentials"
  });

  const token = await requestTwitchToken(body);
  appTokenCache = {
    accessToken: token.access_token,
    expiresAt: now + token.expires_in
  };

  return token.access_token;
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
};

async function twitchApiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  requireTwitchCredentials();

  const token = options.token ?? (await getAppAccessToken());
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const url = `${TWITCH_API_BASE}${path}${query.size > 0 ? `?${query.toString()}` : ""}`;
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
    throw new Error(`Twitch API ${path} failed with ${response.status}: ${message}`);
  }

  const remaining = response.headers.get("Ratelimit-Remaining");
  const reset = response.headers.get("Ratelimit-Reset");
  if (remaining === "0" && reset) {
    const waitSeconds = Math.max(Number(reset) - Math.floor(Date.now() / 1000), 1);
    await sleep(waitSeconds * 1000);
  }

  return response.json() as Promise<T>;
}

export async function getTopCategories(cursor?: string) {
  return twitchApiRequest<TwitchResponse<TwitchCategory>>("/games/top", {
    query: {
      first: 30,
      after: cursor
    }
  });
}

export async function searchCategories(query: string, cursor?: string) {
  return twitchApiRequest<TwitchResponse<TwitchCategory>>("/search/categories", {
    query: {
      query,
      first: 30,
      after: cursor
    }
  });
}

export async function searchChannels(query: string, cursor?: string, liveOnly = true) {
  return twitchApiRequest<TwitchResponse<TwitchSearchChannel>>("/search/channels", {
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
    query: {}
  });
}

export async function getStreamsByCategory(input: {
  categoryId: string;
  language?: string | null;
  cursor?: string;
  token?: string;
}) {
  return twitchApiRequest<TwitchResponse<TwitchStream>>("/streams", {
    token: input.token,
    query: {
      game_id: input.categoryId,
      language: input.language,
      first: 100,
      after: input.cursor
    }
  });
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
