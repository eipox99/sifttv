import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { getAppPreferences, upsertAppPreferences, type AppPreferencesRecord } from "@/lib/local-store";
import { normalizeLanguageCode } from "@/lib/formatters";

export type ThemeMode = "dark" | "light";
export type CategorySort = "popular" | "low_to_high_exact";
export type PlaybackEngine = "hls" | "lowlatency";

export type AppPreferences = {
  themeMode: ThemeMode;
  categorySort: CategorySort;
  categoryLanguage: string;
  excludeFollowerOnly: boolean;
  playbackEngine: PlaybackEngine;
  lowLatencyAutoFallback: boolean;
  lowLatencyCatchUp: boolean;
  autoOpenChat: boolean;
  chatAutoLogin: boolean;
  hoverPreview: boolean;
  mpegtsLowLatency: boolean;
  openInNewTab: boolean;
};

type AppPreferencesInput = {
  themeMode?: string | null;
  categorySort?: string | null;
  categoryLanguage?: string | null;
  excludeFollowerOnly?: boolean | null;
  playbackEngine?: string | null;
  lowLatencyAutoFallback?: boolean | null;
  lowLatencyCatchUp?: boolean | null;
  autoOpenChat?: boolean | null;
  chatAutoLogin?: boolean | null;
  hoverPreview?: boolean | null;
  mpegtsLowLatency?: boolean | null;
  openInNewTab?: boolean | null;
};

export const APP_PREFERENCES_COOKIE = "twitch_low_high_owner";

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  themeMode: "dark",
  categorySort: "popular",
  categoryLanguage: "",
  excludeFollowerOnly: false,
  playbackEngine: "lowlatency",
  lowLatencyAutoFallback: true,
  lowLatencyCatchUp: true,
  autoOpenChat: true,
  chatAutoLogin: false,
  hoverPreview: true,
  mpegtsLowLatency: true,
  openInNewTab: false
};

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function normalizeCategorySort(value: string | null | undefined): CategorySort {
  return value === "low_to_high_exact" ? "low_to_high_exact" : "popular";
}

export function normalizeExcludeFollowerOnly(value: boolean | null | undefined) {
  return value === true;
}

export function normalizePlaybackEngine(value: string | null | undefined): PlaybackEngine {
  return value === "hls" ? "hls" : "lowlatency";
}

export function normalizeLowLatencyAutoFallback(value: boolean | null | undefined) {
  return value !== false;
}

export function normalizeLowLatencyCatchUp(value: boolean | null | undefined) {
  return value !== false;
}

export function normalizeAutoOpenChat(value: boolean | null | undefined) {
  return value !== false;
}

export function normalizeChatAutoLogin(value: boolean | null | undefined) {
  return value === true;
}

export function normalizeHoverPreview(value: boolean | null | undefined) {
  return value !== false;
}

export function normalizeMpegtsLowLatency(value: boolean | null | undefined) {
  return value !== false;
}

export function normalizeOpenInNewTab(value: boolean | null | undefined) {
  return value === true;
}

export function normalizeAppPreferences(record: AppPreferencesRecord | null | undefined): AppPreferences {
  if (!record) {
    return DEFAULT_APP_PREFERENCES;
  }

  return {
    themeMode: normalizeThemeMode(record.themeMode),
    categorySort: normalizeCategorySort(record.categorySort),
    categoryLanguage: normalizeLanguageCode(record.categoryLanguage) ?? "",
    excludeFollowerOnly: Boolean(record.excludeFollowerOnly),
    playbackEngine: normalizePlaybackEngine(record.playbackEngine),
    lowLatencyAutoFallback: record.lowLatencyAutoFallback === undefined ? true : Boolean(record.lowLatencyAutoFallback),
    lowLatencyCatchUp: record.lowLatencyCatchUp === undefined ? true : Boolean(record.lowLatencyCatchUp),
    autoOpenChat: record.autoOpenChat === undefined ? true : Boolean(record.autoOpenChat),
    chatAutoLogin: Boolean(record.chatAutoLogin),
    hoverPreview: record.hoverPreview === undefined ? true : Boolean(record.hoverPreview),
    mpegtsLowLatency: record.mpegtsLowLatency === undefined ? true : Boolean(record.mpegtsLowLatency),
    openInNewTab: Boolean(record.openInNewTab)
  };
}

export function buildPreferenceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2
  };
}

export function createPreferencesOwnerId() {
  return randomUUID();
}

export async function getServerAppPreferences() {
  const cookieStore = await cookies();
  const ownerId = cookieStore.get(APP_PREFERENCES_COOKIE)?.value;

  return normalizeAppPreferences(ownerId ? getAppPreferences(ownerId) : null);
}

export function ensureStoredAppPreferences(ownerId: string, input?: AppPreferencesInput) {
  const stored = upsertAppPreferences(ownerId, {
    themeMode: input?.themeMode ? normalizeThemeMode(input.themeMode) : undefined,
    categorySort: input?.categorySort ? normalizeCategorySort(input.categorySort) : undefined,
    categoryLanguage:
      input && "categoryLanguage" in input ? normalizeLanguageCode(input.categoryLanguage) : undefined,
    excludeFollowerOnly:
      input?.excludeFollowerOnly == null ? undefined : normalizeExcludeFollowerOnly(input.excludeFollowerOnly),
    playbackEngine: input?.playbackEngine ? normalizePlaybackEngine(input.playbackEngine) : undefined,
    lowLatencyAutoFallback:
      input?.lowLatencyAutoFallback == null
        ? undefined
        : normalizeLowLatencyAutoFallback(input.lowLatencyAutoFallback),
    lowLatencyCatchUp:
      input?.lowLatencyCatchUp == null ? undefined : normalizeLowLatencyCatchUp(input.lowLatencyCatchUp),
    autoOpenChat: input?.autoOpenChat == null ? undefined : normalizeAutoOpenChat(input.autoOpenChat),
    chatAutoLogin: input?.chatAutoLogin == null ? undefined : normalizeChatAutoLogin(input.chatAutoLogin),
    hoverPreview: input?.hoverPreview == null ? undefined : normalizeHoverPreview(input.hoverPreview),
    mpegtsLowLatency: input?.mpegtsLowLatency == null ? undefined : normalizeMpegtsLowLatency(input.mpegtsLowLatency),
    openInNewTab: input?.openInNewTab == null ? undefined : normalizeOpenInNewTab(input.openInNewTab)
  });

  return normalizeAppPreferences(stored);
}
