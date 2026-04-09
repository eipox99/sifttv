import { CategoryExplorer } from "@/components/category-explorer";
import { OnboardingCard } from "@/components/onboarding-card";
import { hasTwitchClientCredentials } from "@/lib/env";
import { serializeTwitchStream } from "@/lib/serializers";
import { getGamesByIds, getStreamsByCategory } from "@/lib/twitch";

export default async function CategoryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!hasTwitchClientCredentials()) {
    return <OnboardingCard />;
  }

  try {
    const [categoryResponse, streamsResponse] = await Promise.all([
      getGamesByIds([id]),
      getStreamsByCategory({
        categoryId: id
      })
    ]);

    const categoryName = categoryResponse.data[0]?.name ?? "Unknown category";
    const initialPopular = streamsResponse.data.map(serializeTwitchStream);

    return (
      <CategoryExplorer
        categoryId={id}
        categoryName={categoryName}
        initialPopular={initialPopular}
        initialCursor={streamsResponse.pagination?.cursor ?? null}
        exactReady={true}
      />
    );
  } catch (error) {
    return <OnboardingCard title={error instanceof Error ? error.message : "Failed to load category"} />;
  }
}
