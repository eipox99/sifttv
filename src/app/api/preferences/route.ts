import { NextRequest, NextResponse } from "next/server";

import {
  APP_PREFERENCES_COOKIE,
  buildPreferenceCookieOptions,
  createPreferencesOwnerId,
  DEFAULT_APP_PREFERENCES,
  ensureStoredAppPreferences,
  normalizeAutoOpenChat,
  normalizeCategorySort,
  normalizeChatAutoLogin,
  normalizeExcludeFollowerOnly,
  normalizeHoverPreview,
  normalizeLowLatencyAutoFallback,
  normalizeLowLatencyCatchUp,
  normalizeMpegtsLowLatency,
  normalizeOpenInNewTab,
  normalizePlaybackEngine,
  normalizeThemeMode
} from "@/lib/preferences";
import { normalizeLanguageCode } from "@/lib/formatters";
import { jsonError } from "@/lib/http";

function getOrCreateOwnerId(request: NextRequest) {
  return request.cookies.get(APP_PREFERENCES_COOKIE)?.value ?? createPreferencesOwnerId();
}

export async function GET(request: NextRequest) {
  const ownerId = getOrCreateOwnerId(request);
  const preferences = ensureStoredAppPreferences(ownerId, DEFAULT_APP_PREFERENCES);
  const response = NextResponse.json({
    preferences
  });

  if (!request.cookies.get(APP_PREFERENCES_COOKIE)?.value) {
    response.cookies.set(APP_PREFERENCES_COOKIE, ownerId, buildPreferenceCookieOptions());
  }

  return response;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      themeMode?: string;
      categorySort?: string;
      categoryLanguage?: string | null;
      excludeFollowerOnly?: boolean;
      playbackEngine?: string;
      lowLatencyAutoFallback?: boolean;
      lowLatencyCatchUp?: boolean;
      autoOpenChat?: boolean;
      chatAutoLogin?: boolean;
      hoverPreview?: boolean;
      mpegtsLowLatency?: boolean;
      openInNewTab?: boolean;
    };

    const ownerId = getOrCreateOwnerId(request);
    const preferences = ensureStoredAppPreferences(ownerId, {
      themeMode: body.themeMode ? normalizeThemeMode(body.themeMode) : undefined,
      categorySort: body.categorySort ? normalizeCategorySort(body.categorySort) : undefined,
      categoryLanguage:
        body.categoryLanguage === undefined ? undefined : normalizeLanguageCode(body.categoryLanguage),
      excludeFollowerOnly:
        body.excludeFollowerOnly === undefined ? undefined : normalizeExcludeFollowerOnly(body.excludeFollowerOnly),
      playbackEngine: body.playbackEngine === undefined ? undefined : normalizePlaybackEngine(body.playbackEngine),
      lowLatencyAutoFallback:
        body.lowLatencyAutoFallback === undefined
          ? undefined
          : normalizeLowLatencyAutoFallback(body.lowLatencyAutoFallback),
      lowLatencyCatchUp:
        body.lowLatencyCatchUp === undefined ? undefined : normalizeLowLatencyCatchUp(body.lowLatencyCatchUp),
      autoOpenChat: body.autoOpenChat === undefined ? undefined : normalizeAutoOpenChat(body.autoOpenChat),
      chatAutoLogin: body.chatAutoLogin === undefined ? undefined : normalizeChatAutoLogin(body.chatAutoLogin),
      hoverPreview: body.hoverPreview === undefined ? undefined : normalizeHoverPreview(body.hoverPreview),
      mpegtsLowLatency: body.mpegtsLowLatency === undefined ? undefined : normalizeMpegtsLowLatency(body.mpegtsLowLatency),
      openInNewTab: body.openInNewTab === undefined ? undefined : normalizeOpenInNewTab(body.openInNewTab)
    });

    const response = NextResponse.json({
      preferences
    });

    if (!request.cookies.get(APP_PREFERENCES_COOKIE)?.value) {
      response.cookies.set(APP_PREFERENCES_COOKIE, ownerId, buildPreferenceCookieOptions());
    }

    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save preferences.", 500);
  }
}
