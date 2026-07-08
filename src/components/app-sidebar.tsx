"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FAVORITES_UPDATED_EVENT } from "@/lib/favorites-events";
import { fetchSharedJson } from "@/lib/client-fetch";
import { formatViewerCount } from "@/lib/formatters";
import { ChannelSortSelect } from "@/components/channel-sort-select";
import { DEFAULT_CHANNEL_SORT, sortChannels, type ChannelSortKey } from "@/lib/channel-sort";
import { usePlayer } from "@/components/stream-player";
import { usePreferences } from "@/components/preferences-store";

type SidebarFollowedStream = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  language: string;
  thumbnailUrl: string;
  categoryName: string;
  categoryId: string;
  url: string;
};

type SidebarFavorite = {
  id: string;
  channelId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
  isLive?: boolean;
  viewerCount?: number | null;
  title?: string | null;
  url: string;
};

type AppSidebarProps = {
  authReady: boolean;
};

const AVATAR_COLORS = [
  "#9146ff", "#e91916", "#fac834", "#00c7b1", "#ff75e6",
  "#1e69cc", "#eb0400", "#0d9c90", "#ff4d4d", "#3db5ff"
];

function avatarColor(login: string) {
  let hash = 0;
  for (let i = 0; i < login.length; i++) {
    hash = login.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function AvatarImage({ login, displayName }: { login: string; displayName: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="sidebar-item-avatar" style={{ background: avatarColor(login) }}>
        {displayName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      className="sidebar-item-avatar"
      src={`/api/avatar/${login}`}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function AppSidebar({ authReady }: AppSidebarProps) {
  const { open } = usePlayer();
  const { openInNewTab } = usePreferences();
  const { data: session, status } = useSession();
  const [followed, setFollowed] = useState<SidebarFollowedStream[]>([]);
  const [favorites, setFavorites] = useState<SidebarFavorite[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [followedError, setFollowedError] = useState<string | null>(null);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoritesRefreshKey, setFavoritesRefreshKey] = useState(0);
  const [sortKey, setSortKey] = useState<ChannelSortKey>(DEFAULT_CHANNEL_SORT);
  const [pollTick, setPollTick] = useState(0);
  const hasFollowedRef = useRef(false);
  const hasFavoritesRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setPollTick((c) => c + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const visibleFollowed = useMemo(
    () =>
      sortChannels(
        followed,
        sortKey,
        (stream) => stream.displayName,
        (stream) => stream.viewerCount
      ),
    [followed, sortKey]
  );
  const visibleFavorites = useMemo(
    () =>
      sortChannels(
        favorites.filter((favorite) => favorite.isLive),
        sortKey,
        (favorite) => favorite.broadcasterName,
        (favorite) => favorite.viewerCount ?? 0
      ),
    [favorites, sortKey]
  );
  const liveFavoritesCount = useMemo(
    () => favorites.filter((favorite) => favorite.isLive).length,
    [favorites]
  );

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

    const controller = new AbortController();
    if (!hasFollowedRef.current) {
      setLoadingFollowed(true);
    }
    setFollowedError(null);

    fetchSharedJson<{ data?: SidebarFollowedStream[] }>("/api/followed/live", { signal: controller.signal })
      .then((payload) => {
        setFollowed(payload.data ?? []);
        hasFollowedRef.current = true;
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setFollowed([]);
          setFollowedError(error instanceof Error ? error.message : "Failed to load followed live.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingFollowed(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [authReady, session?.user?.id, status, pollTick]);

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

    const controller = new AbortController();
    if (!hasFavoritesRef.current) {
      setLoadingFavorites(true);
    }
    setFavoritesError(null);

    fetch("/api/favorites", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load favorites.");
        }

        setFavorites(payload.data ?? []);
        hasFavoritesRef.current = true;
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setFavorites([]);
          setFavoritesError(error instanceof Error ? error.message : "Failed to load favorites.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingFavorites(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [authReady, favoritesRefreshKey, session?.user?.id, status, pollTick]);

  return (
    <aside className="app-sidebar">
      <div className="panel sidebar-panel stack-md">
        <div>
          <h2>Followed and favorites</h2>
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
            <div className="sidebar-sort">
              <ChannelSortSelect value={sortKey} onChange={setSortKey} ariaLabel="Sort followed and favorites" />
            </div>
            <section className="sidebar-section stack-sm">
              <div className="section-head">
                <h3>Followed</h3>
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
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => {
                      if (openInNewTab) {
                        window.open(`/watch/${stream.login}`, "_blank");
                      } else {
                        open({
                          login: stream.login,
                          displayName: stream.displayName,
                          channelId: stream.channelId,
                          title: stream.title,
                          categoryName: stream.categoryName,
                          categoryId: stream.categoryId,
                          thumbnailUrl: stream.thumbnailUrl,
                          url: stream.url
                        });
                      }
                    }}
                    className="sidebar-item"
                    title={stream.title}
                  >
                    <AvatarImage login={stream.login} displayName={stream.displayName} />
                    <div className="sidebar-item-body">
                      <div className="sidebar-item-row">
                        <strong className="sidebar-item-name">{stream.displayName}</strong>
                        <span className="sidebar-item-viewers">
                          {formatViewerCount(stream.viewerCount)}
                        </span>
                      </div>
                      <div className="sidebar-item-category">{stream.categoryName || "Live"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="sidebar-section stack-sm">
              <div className="section-head">
                <h3>Favorites</h3>
                <Link href="/favorites" className="pill">
                  {liveFavoritesCount}
                </Link>
              </div>
              {loadingFavorites ? <div className="pill">Loading favorites</div> : null}
              {favoritesError ? <div className="sidebar-note">{favoritesError}</div> : null}
              {!loadingFavorites && !favoritesError && visibleFavorites.length === 0 ? (
                <div className="sidebar-note">
                  {favorites.length === 0
                    ? "Save channels from stream cards and they will stay pinned here."
                    : "None of your favorites are live right now."}
                </div>
              ) : null}
              <div className="sidebar-list">
                {visibleFavorites.map((favorite) => (
                  <button
                    key={favorite.id}
                    type="button"
                    onClick={() => {
                      if (openInNewTab) {
                        window.open(`/watch/${favorite.broadcasterLogin}`, "_blank");
                      } else {
                        open({
                          login: favorite.broadcasterLogin,
                          displayName: favorite.broadcasterName,
                          channelId: favorite.channelId,
                          categoryName: favorite.categoryName,
                          categoryId: favorite.categoryId,
                          thumbnailUrl: favorite.thumbnailUrl,
                          url: favorite.url
                        });
                      }
                    }}
                    className="sidebar-item"
                    title={favorite.title ?? favorite.broadcasterName}
                  >
                    <AvatarImage login={favorite.broadcasterLogin} displayName={favorite.broadcasterName} />
                    <div className="sidebar-item-body">
                      <div className="sidebar-item-row">
                        <strong className="sidebar-item-name">{favorite.broadcasterName}</strong>
                        <span className="sidebar-item-viewers">
                          {favorite.isLive ? formatViewerCount(favorite.viewerCount ?? 0) : "Offline"}
                        </span>
                      </div>
                      <div className="sidebar-item-category">
                        {favorite.categoryName ?? "Saved channel"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </aside>
  );
}
