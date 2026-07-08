import { BrowseStreams } from "@/components/browse-streams";
import { OnboardingCard } from "@/components/onboarding-card";
import { hasTwitchClientCredentials } from "@/lib/env";
import { buildTwitchThumbnail, formatDateTime } from "@/lib/formatters";
import { CATEGORY_STREAM_BATCH_SIZE } from "@/lib/pagination";
import { getAllStreams } from "@/lib/twitch";

export default async function BrowsePage() {
  if (!hasTwitchClientCredentials()) {
    return <OnboardingCard />;
  }

  try {
    const response = await getAllStreams({ limit: CATEGORY_STREAM_BATCH_SIZE });
    const initialStreams = response.data.map((stream) => ({
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
        initialCursor={response.pagination?.cursor ?? null}
      />
    );
  } catch (error) {
    return <OnboardingCard title={error instanceof Error ? error.message : "Failed to load streams"} />;
  }
}
