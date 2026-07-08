import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { env } from "@/lib/env";
import { refreshAccessTokenFromRefreshToken } from "@/lib/twitch";

export type ResolvedTwitchToken = { accessToken: string; userId: string };

// Cache refreshed access tokens per refresh token so concurrent/subsequent
// requests in the same process don't each hit Twitch's token endpoint.
const refreshCache = new Map<string, { accessToken: string; expiresAt: number }>();

// Behind a TLS-terminating proxy (e.g. `tailscale serve`) the internal request
// is plain HTTP, but the session cookie is the `__Secure-` variant. Detect the
// original scheme so getToken looks for the right cookie name (and salt).
function requestUsesSecureCookies(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim() === "https";
  }
  try {
    if (new URL(request.url).protocol === "https:") {
      return true;
    }
  } catch {
    // ignore malformed URL
  }
  return (process.env.AUTH_URL ?? "").startsWith("https://");
}

// `getToken` only decodes the stored JWT — it does not run the auth `jwt`
// callback, so it never refreshes an expired Twitch access token. This resolves
// a usable token for API routes, refreshing on demand when the stored one is
// expired (or about to be).
export async function resolveTwitchUserToken(request: NextRequest): Promise<ResolvedTwitchToken | null> {
  const token = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
    secureCookie: requestUsesSecureCookies(request)
  });

  const accessToken = token?.twitchAccessToken;
  const userId = token?.twitchUserId;
  const refreshToken = token?.twitchRefreshToken;
  const expiresAt = token?.twitchAccessTokenExpiresAt;

  if (!accessToken || !userId) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // Still valid.
  if (expiresAt && expiresAt > now + 30) {
    return { accessToken, userId };
  }

  // Expired but nothing to refresh with — return what we have.
  if (!refreshToken) {
    return { accessToken, userId };
  }

  const cached = refreshCache.get(refreshToken);
  if (cached && cached.expiresAt > now + 30) {
    return { accessToken: cached.accessToken, userId };
  }

  try {
    const refreshed = await refreshAccessTokenFromRefreshToken(refreshToken);
    refreshCache.set(refreshToken, {
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt
    });
    return { accessToken: refreshed.accessToken, userId };
  } catch {
    // Refresh failed (e.g. refresh token revoked) — fall back to the stored
    // token; the caller will surface the resulting error.
    return { accessToken, userId };
  }
}
