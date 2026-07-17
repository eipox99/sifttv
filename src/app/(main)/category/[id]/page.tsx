import { CategoryExplorer } from "@/components/category-explorer";
import { discoverCategoryLanguages, loadPopularCategoryStreams } from "@/lib/category-streams";
import { OnboardingCard } from "@/components/onboarding-card";
import { hasTwitchClientCredentials } from "@/lib/env";
import { CATEGORY_STREAM_BATCH_SIZE } from "@/lib/pagination";
import { getServerAppPreferences } from "@/lib/preferences";
import { addKnownLanguages } from "@/lib/local-store";
import { getGamesByIds } from "@/lib/twitch";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const preferences = await getServerAppPreferences();
  const initialSort = preferences.categorySort;
  const initialLanguage = preferences.categoryLanguage;
  const initialExcludeFollowerOnly = preferences.excludeFollowerOnly;

  if (!hasTwitchClientCredentials()) {
    return <OnboardingCard />;
  }

  try {
    const [categoryResponse, streamsResponse, availableLanguages] = await Promise.all([
      getGamesByIds([id]),
      loadPopularCategoryStreams({
        categoryId: id,
        language: initialLanguage || undefined,
        limit: CATEGORY_STREAM_BATCH_SIZE,
        excludeFollowerOnly: initialExcludeFollowerOnly
      }),
      discoverCategoryLanguages(id)
    ]);

    // Merge into the persistent master language list.
    addKnownLanguages(availableLanguages);

    const category = categoryResponse.data[0];
    const categoryName = category?.name ?? "Unknown category";
    const boxArtUrl = category?.box_art_url?.replace("{width}", "320").replace("{height}", "430");
    const initialPopular = streamsResponse.data;

    return (
      <CategoryExplorer
        categoryId={id}
        categoryName={categoryName}
        boxArtUrl={boxArtUrl}
        initialPopular={initialPopular}
        initialCursor={streamsResponse.cursor}
        initialSort={initialSort}
        initialLanguage={initialLanguage}
        initialAvailableLanguages={availableLanguages}
        initialExcludeFollowerOnly={initialExcludeFollowerOnly}
        exactReady={true}
      />
    );
  } catch (error) {
    return <OnboardingCard title={error instanceof Error ? error.message : "Failed to load category"} />;
  }
}
