import { BrowseStreams } from "@/components/browse-streams";
import { OnboardingCard } from "@/components/onboarding-card";
import { hasTwitchClientCredentials } from "@/lib/env";
import { buildTwitchThumbnail, formatDateTime, normalizeLanguageCode } from "@/lib/formatters";
import { addKnownLanguages, getKnownLanguages } from "@/lib/local-store";
import { CATEGORY_STREAM_BATCH_SIZE } from "@/lib/pagination";
import { getAllStreams } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export default async function BrowsePage() {
  if (!hasTwitchClientCredentials()) {
    return <OnboardingCard />;
  }

  try {
    let availableLanguages = getKnownLanguages();

    // No cached language data yet — discover from top streams and persist.
    if (availableLanguages.length === 0) {
      const codes = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        const response = await getAllStreams({ cursor, limit: 100 });
        for (const stream of response.data) {
          const code = normalizeLanguageCode(stream.language);
          if (code) codes.add(code);
        }
        cursor = response.pagination?.cursor;
        if (!cursor || response.data.length === 0) break;
      }
      availableLanguages = Array.from(codes).sort((a, b) => a.localeCompare(b));
      addKnownLanguages(availableLanguages);
    }

    const streamsResponse = await getAllStreams({ limit: CATEGORY_STREAM_BATCH_SIZE });
    const initialStreams = streamsResponse.data.map((stream) => ({
      id: stream.id,
      channelId: stream.user_id,
      login: stream.user_login,
      displayName: stream.user_name,
      title: stream.title,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      startedAtLabel: formatDateTime(stream.started_at),
      language: stream.language,
      thumbnailUrl: buildTwitchThumbnail(stream.thumbnail_url),
      categoryId: stream.game_id,
      categoryName: stream.game_name
    }));

    return (
      <BrowseStreams
        initialStreams={initialStreams}
        initialCursor={streamsResponse.pagination?.cursor ?? null}
        initialAvailableLanguages={availableLanguages}
      />
    );
  } catch (error) {
    return <OnboardingCard title={error instanceof Error ? error.message : "Failed to load streams"} />;
  }
}
