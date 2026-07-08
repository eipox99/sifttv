import { OnboardingCard } from "@/components/onboarding-card";
import { TopCategories } from "@/components/top-categories";
import { serializeCategory } from "@/lib/serializers";
import { hasTwitchClientCredentials } from "@/lib/env";
import { getTopCategories } from "@/lib/twitch";

export default async function HomePage() {
  if (!hasTwitchClientCredentials()) {
    return <OnboardingCard />;
  }

  try {
    const response = await getTopCategories();
    const categories = response.data.map(serializeCategory);
    const cursor = response.pagination?.cursor ?? null;

    return (
      <section className="stack-lg">
        <TopCategories initialCategories={categories} initialCursor={cursor} />
      </section>
    );
  } catch (error) {
    return <OnboardingCard title={error instanceof Error ? error.message : "Could not load Twitch"} />;
  }
}

