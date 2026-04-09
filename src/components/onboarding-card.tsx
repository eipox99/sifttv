import Link from "next/link";

type OnboardingCardProps = {
  title?: string;
};

export function OnboardingCard({ title = "App setup required" }: OnboardingCardProps) {
  return (
    <section className="panel onboarding">
      <p className="eyebrow">{title}</p>
      <h2>Configure Twitch before live browsing can start.</h2>
      <p className="muted">
        Add your Twitch app credentials and auth secret in
        <code> .env </code>
        so the app can call Helix and complete sign-in.
      </p>
      <div className="code-list">
        <code>TWITCH_CLIENT_ID</code>
        <code>TWITCH_CLIENT_SECRET</code>
        <code>AUTH_SECRET</code>
      </div>
      <p className="muted">
        Create the Twitch app at{" "}
        <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer">
          dev.twitch.tv/console/apps
        </a>{" "}
        with redirect URL <code>/api/auth/callback/twitch</code>.
      </p>
      <Link href="/login" className="button button-primary">
        Open login page
      </Link>
    </section>
  );
}
