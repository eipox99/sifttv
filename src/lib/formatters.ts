export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatViewerCount(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

export function normalizeLanguageCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

const languageLabelOverrides: Record<string, string> = {
  "zh-hk": "Chinese (Hong Kong)",
};

const languageDisplayNames = new Intl.DisplayNames(["en"], {
  type: "language",
});

export function formatLanguageLabel(value: string | null | undefined) {
  const normalized = normalizeLanguageCode(value);
  if (!normalized) {
    return "Unknown";
  }

  if (normalized === "other") {
    return "Other";
  }

  const label = languageLabelOverrides[normalized] ?? (() => {
    try {
      const display = languageDisplayNames.of(normalized);
      if (display && display.toLowerCase() !== normalized) return display;
    } catch {}
    return null;
  })();

  if (label) {
    return `${label} (${normalized.toUpperCase()})`;
  }

  return normalized.toUpperCase();
}

export function buildTwitchThumbnail(url: string, width = 320, height = 180) {
  return url.replace("{width}", String(width)).replace("{height}", String(height));
}

export function buildLivePreviewUrl(login: string, width = 320, height = 180) {
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login.toLowerCase()}-${width}x${height}.jpg`;
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
