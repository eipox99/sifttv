import LoginButton from "./login-button";

import { OnboardingCard } from "@/components/onboarding-card";
import { hasAuthRuntimeConfig } from "@/lib/env";

export default function LoginPage() {
  if (!hasAuthRuntimeConfig()) {
    return <OnboardingCard title="Sign-in is not ready yet" />;
  }

  return (
    <section className="panel login-panel">
      <p className="eyebrow">Twitch OAuth</p>
      <h1>Sign in with your Twitch account</h1>
      <p className="muted">
        This uses Twitch&apos;s official OAuth flow. If the browser is already signed in to Twitch, that session is
        reused and you typically only need to approve this app.
      </p>
      <LoginButton />
    </section>
  );
}
