"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { FAVORITES_UPDATED_EVENT } from "@/lib/favorites-events";
import { formatLanguageLabel, formatViewerCount } from "@/lib/formatters";

type SidebarFollowedStream = {
  id: string;
  displayName: string;
  title: string;
  viewerCount: number;
  language: string;
  thumbnailUrl: string;
  categoryName: string;
  url: string;
};

type SidebarFavorite = {
  id: string;
  broadcasterLogin: string;
  broadcasterName: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  url: string;
};

type AppSidebarProps = {
  authReady: boolean;
};

const MAX_ITEMS = 6;

export function AppSidebar({ authReady }: AppSidebarProps) {
  const { data: session, status } = useSession();
  const [followed, setFollowed] = useState<SidebarFollowedStream[]>([]);
  const [favorites, setFavorites] = useState<SidebarFavorite[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [followedError, setFollowedError] = useState<string | null>(null);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoritesRefreshKey, setFavoritesRefreshKey] = useState(0);

  const visibleFollowed = useMemo(() => followed.slice(0, MAX_ITEMS), [followed]);
  const visibleFavorites = useMemo(() => favorites.slice(0, MAX_ITEMS), [favorites]);

  useEffect(() => {
    const handleFavoritesUpdated = () => {
      setFavoritesRefreshKey((current) => current + 1);
    };

    window.addEventListener(FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);
    };
  }, []);

  useEffect(() => {
    if (!authReady || status === "loading") {
      return;
    }

    if (!session?.user) {
      setFollowed([]);
      setFavorites([]);
      setFollowedError(null);
      setFavoritesError(null);
      setLoadingFollowed(false);
      setLoadingFavorites(false);
      return;
    }

    let active = true;
    setLoadingFollowed(true);
    setFollowedError(null);

    fetch("/api/followed/live", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load followed live.");
        }

        if (active) {
          setFollowed(payload.data ?? []);
        }
      })
      .catch((error) => {
        if (active) {
          setFollowed([]);
          setFollowedError(error instanceof Error ? error.message : "Failed to load followed live.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingFollowed(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authReady, session?.user?.id, status]);

  useEffect(() => {
    if (!authReady || status === "loading") {
      return;
    }

    if (!session?.user) {
      setFavorites([]);
      setFavoritesError(null);
      setLoadingFavorites(false);
      return;
    }

    let active = true;
    setLoadingFavorites(true);
    setFavoritesError(null);

    fetch("/api/favorites", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load favorites.");
        }

        if (active) {
          setFavorites(payload.data ?? []);
        }
      })
      .catch((error) => {
        if (active) {
          setFavorites([]);
          setFavoritesError(error instanceof Error ? error.message : "Failed to load favorites.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingFavorites(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authReady, favoritesRefreshKey, session?.user?.id, status]);

  return (
    <aside className="app-sidebar">
      <div className="panel sidebar-panel stack-md">
        <div>
          <p className="eyebrow">Quick Access</p>
          <h2>Followed and favorites</h2>
          <p className="muted">Keep your signed-in stream shortcuts visible while browsing categories.</p>
        </div>

        {!authReady ? (
          <div className="sidebar-empty">
            <p className="muted">Twitch sign-in is not configured yet, so the personal sidebar is unavailable.</p>
          </div>
        ) : null}

        {authReady && status === "loading" ? <div className="pill">Checking session</div> : null}

        {authReady && status !== "loading" && !session?.user ? (
          <div className="sidebar-empty stack-sm">
            <p className="muted">Sign in with Twitch to load your followed live streams and app favorites here.</p>
            <Link href="/login" className="button button-primary">
              Sign in
            </Link>
          </div>
        ) : null}

        {session?.user ? (
          <>
            <section className="sidebar-section stack-sm">
              <div className="section-head">
                <h3>Followed Live</h3>
                <Link href="/followed" className="pill">
                  {followed.length}
                </Link>
              </div>
              {loadingFollowed ? <div className="pill">Loading followed</div> : null}
              {followedError ? <div className="sidebar-note">{followedError}</div> : null}
              {!loadingFollowed && !followedError && visibleFollowed.length === 0 ? (
                <div className="sidebar-note">No followed channels are live right now.</div>
              ) : null}
              <div className="sidebar-list">
                {visibleFollowed.map((stream) => (
                  <a
                    key={stream.id}
                    href={stream.url}
                    target="_blank"
                    rel="noreferrer"
                    className="sidebar-item-card"
                  >
                    <img src={stream.thumbnailUrl} alt={stream.title} className="sidebar-item-thumb" />
                    <div className="sidebar-item-copy">
                      <strong className="sidebar-item-title">{stream.title}</strong>
                      <div className="sidebar-item-subtitle">{stream.displayName}</div>
                      <div className="sidebar-item-meta">
                        <span>{stream.categoryName || "Live"}</span>
                        <span>{formatViewerCount(stream.viewerCount)} viewers</span>
                      </div>
                      <div className="sidebar-item-meta">
                        <span>{formatLanguageLabel(stream.language)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <section className="sidebar-section stack-sm">
              <div className="section-head">
                <h3>Favorites</h3>
                <Link href="/favorites" className="pill">
                  {favorites.length}
                </Link>
              </div>
              {loadingFavorites ? <div className="pill">Loading favorites</div> : null}
              {favoritesError ? <div className="sidebar-note">{favoritesError}</div> : null}
              {!loadingFavorites && !favoritesError && visibleFavorites.length === 0 ? (
                <div className="sidebar-note">Save channels from stream cards and they will stay pinned here.</div>
              ) : null}
              <div className="sidebar-list">
                {visibleFavorites.map((favorite) => (
                  <a
                    key={favorite.id}
                    href={favorite.url}
                    target="_blank"
                    rel="noreferrer"
                    className="sidebar-item-card sidebar-favorite-item"
                  >
                    {favorite.thumbnailUrl ? (
                      <img
                        src={favorite.thumbnailUrl}
                        alt={favorite.broadcasterName}
                        className="sidebar-item-thumb"
                      />
                    ) : (
                      <div className="sidebar-item-thumb sidebar-item-thumb-fallback">{favorite.broadcasterName}</div>
                    )}
                    <div className="sidebar-item-copy">
                      <strong className="sidebar-item-title">{favorite.broadcasterName}</strong>
                      <div className="sidebar-item-subtitle">@{favorite.broadcasterLogin}</div>
                      <div className="sidebar-item-meta">
                        <span>{favorite.categoryName ?? "Saved channel"}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </aside>
  );
}
