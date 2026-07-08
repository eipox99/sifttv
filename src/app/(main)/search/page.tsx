import { SearchExplorer } from "@/components/search-explorer";
import { OnboardingCard } from "@/components/onboarding-card";
import { hasTwitchClientCredentials } from "@/lib/env";

export default function SearchPage() {
  if (!hasTwitchClientCredentials()) {
    return <OnboardingCard />;
  }

  return <SearchExplorer />;
}

