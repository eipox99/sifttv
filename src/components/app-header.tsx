import Link from "next/link";

import { SessionControls } from "@/components/session-controls";
import { ThemeToggle } from "@/components/theme-toggle";

type AppHeaderProps = {
  authReady: boolean;
};

export function AppHeader({ authReady }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <Link href="/" className="brand-link">
          Twitch Low High
        </Link>
        <p className="brand-copy">
          Browse live Twitch with exact low-to-high snapshots when Twitch itself will not.
        </p>
      </div>
      <nav className="nav-links">
        <Link href="/">Home</Link>
        <Link href="/search">Search</Link>
        <Link href="/followed">Followed Live</Link>
        <Link href="/favorites">Favorites</Link>
      </nav>
      <div className="header-actions">
        <ThemeToggle />
        <SessionControls authReady={authReady} />
      </div>
    </header>
  );
}
