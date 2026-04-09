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

const languageDisplayNames = new Intl.DisplayNames(["en"], {
  type: "language"
});

export function normalizeLanguageCode(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function formatLanguageLabel(value: string | null | undefined) {
  const normalized = normalizeLanguageCode(value);
  if (!normalized) {
    return "Unknown";
  }

  if (normalized === "other") {
    return "Other";
  }

  try {
    const label = languageDisplayNames.of(normalized);
    if (label && label.toLowerCase() !== normalized) {
      return `${label} (${normalized.toUpperCase()})`;
    }
  } catch {}

  return normalized.toUpperCase();
}

export function buildTwitchThumbnail(url: string, width = 320, height = 180) {
  return url.replace("{width}", String(width)).replace("{height}", String(height));
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
