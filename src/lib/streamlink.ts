import { execFile } from "node:child_process";

import { env } from "@/lib/env";

const STREAMLINK_BIN = env.STREAMLINK_BIN;
const FFMPEG_BIN = env.FFMPEG_BIN;
const STREAMLINK_TIMEOUT_MS = 45_000;

const TWITCH_LOGIN_PATTERN = /^[a-zA-Z0-9_]{1,25}$/;

const QUALITY_SPECIFIERS: Record<string, string> = {
  best: "best",
  source: "best",
  "1080p": "1080p60,1080p,best",
  "720p": "720p60,720p,480p,best",
  "480p": "480p,360p,worst",
  "360p": "360p,160p,worst",
  audio: "audio_only",
  worst: "worst"
};

export const STREAMLINK_BINARY = STREAMLINK_BIN;
export const FFMPEG_BINARY = FFMPEG_BIN;

export type StreamlinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: "offline" | "not_found" | "error"; message: string };

export function isValidTwitchLogin(login: string): boolean {
  return TWITCH_LOGIN_PATTERN.test(login);
}

const SAFE_QUALITY_TOKEN = /^[a-z0-9_]+$/;

export function resolveStreamlinkQuality(quality?: string | null): string {
  if (!quality) {
    return QUALITY_SPECIFIERS.best;
  }

  const normalized = quality.toLowerCase();
  if (QUALITY_SPECIFIERS[normalized]) {
    return QUALITY_SPECIFIERS[normalized];
  }

  // Allow real streamlink quality names (e.g. "1080p60", "720p", "audio_only")
  // to pass through, falling back to best if the token looks unsafe.
  if (SAFE_QUALITY_TOKEN.test(normalized)) {
    return `${normalized},best`;
  }

  return QUALITY_SPECIFIERS.best;
}

export function getStreamQualities(login: string, signal?: AbortSignal): Promise<string[]> {
  if (!isValidTwitchLogin(login)) {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const child = execFile(
      STREAMLINK_BIN,
      ["--json", "--twitch-disable-ads", `https://www.twitch.tv/${login}`],
      { timeout: STREAMLINK_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (_error, stdout) => {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }

        try {
          const parsed = JSON.parse(stdout) as { streams?: Record<string, unknown> };
          const keys = parsed.streams ? Object.keys(parsed.streams) : [];
          resolve(keys.filter((key) => key !== "best" && key !== "worst"));
        } catch {
          resolve([]);
        }
      }
    );

    function onAbort() {
      child.kill("SIGKILL");
      resolve([]);
    }

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function resolveQuality(quality?: string | null): string {
  return resolveStreamlinkQuality(quality);
}

export function resolveStreamPlaybackUrl(
  login: string,
  quality?: string | null,
  signal?: AbortSignal
): Promise<StreamlinkResult> {
  if (!isValidTwitchLogin(login)) {
    return Promise.resolve({ ok: false, reason: "not_found", message: "Invalid channel name." });
  }

  if (signal?.aborted) {
    return Promise.resolve({ ok: false, reason: "error", message: "Request aborted." });
  }

  const specifier = resolveQuality(quality);
  const args = [
    "--stream-url",
    "--twitch-disable-ads",
    `https://www.twitch.tv/${login}`,
    specifier
  ];

  return new Promise((resolve) => {
    const child = execFile(
      STREAMLINK_BIN,
      args,
      { timeout: STREAMLINK_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }

        const output = `${stdout}${stderr}`.trim();

        if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          resolve({ ok: false, reason: "error", message: "Streamlink is not installed on the server." });
          return;
        }

        const url = stdout.trim().split(/\s+/).find((line) => line.startsWith("http"));

        if (url) {
          resolve({ ok: true, url });
          return;
        }

        if (/No playable streams found/i.test(output) || /offline/i.test(output)) {
          resolve({ ok: false, reason: "offline", message: "This channel is offline right now." });
          return;
        }

        if (/Unable to find channel|404 Client Error|No suitable/i.test(output)) {
          resolve({ ok: false, reason: "not_found", message: "Channel not found." });
          return;
        }

        resolve({
          ok: false,
          reason: "error",
          message: output || "Failed to resolve the stream."
        });
      }
    );

    function onAbort() {
      child.kill("SIGKILL");
      resolve({ ok: false, reason: "error", message: "Request aborted." });
    }

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
