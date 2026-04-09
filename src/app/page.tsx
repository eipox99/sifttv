import { CategoryCard } from "@/components/category-card";
import { OnboardingCard } from "@/components/onboarding-card";
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

    return (
      <section className="stack-lg">
        <div className="hero panel">
          <div>
            <p className="eyebrow">Live discovery</p>
            <h1>Browse Twitch with better control over low-viewer discovery.</h1>
            <p className="muted">
              Start from a category, switch between Twitch&apos;s native popular ranking and an exact ascending snapshot,
              then save channels locally without changing your Twitch follows.
            </p>
          </div>
        </div>

        <section className="panel stack-md">
          <div className="section-head">
            <h2>Top categories</h2>
            <span className="pill">{categories.length}</span>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <CategoryCard key={category.id} {...category} />
            ))}
          </div>
        </section>
      </section>
    );
  } catch (error) {
    return <OnboardingCard title={error instanceof Error ? error.message : "Could not load Twitch"} />;
  }
}

