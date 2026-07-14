import Link from "next/link";

import { SessionControls } from "@/components/session-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ThemeMode } from "@/lib/preferences";

type AppHeaderProps = {
  authReady: boolean;
  initialThemeMode: ThemeMode;
};

export function AppHeader({ authReady, initialThemeMode }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <Link href="/" className="brand-link">
          <img src="/logo.png" alt="" className="brand-logo" aria-hidden="true" loading="lazy" />
          <span>SiftTV</span>
        </Link>
        <p className="brand-copy">
          Sift through Twitch and surface the small streams the front page buries.
        </p>
      </div>
      <nav className="nav-links">
        <Link href="/">Home</Link>
        <Link href="/search">Search</Link>
        <Link href="/followed">Followed</Link>
        <Link href="/favorites">Favorites</Link>
        <Link href="/settings">Settings</Link>
      </nav>
      <div className="header-actions">
        <ThemeToggle initialThemeMode={initialThemeMode} />
        <SessionControls authReady={authReady} />
      </div>
    </header>
  );
}
