"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CategoryCard } from "@/components/category-card";
import { ChannelSortSelect } from "@/components/channel-sort-select";
import { StreamCard } from "@/components/stream-card";
import { FAVORITES_UPDATED_EVENT } from "@/lib/favorites-events";
import { buildLivePreviewUrl } from "@/lib/formatters";
import { DEFAULT_CHANNEL_SORT, sortChannels, type ChannelSortKey } from "@/lib/channel-sort";

type FavoriteItem = {
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
  startedAt?: string | null;
  url: string;
};

type FavoriteCategory = {
  id: string;
  categoryId: string;
  categoryName: string;
  boxArtUrl: string | null;
};

export function FavoritesPage() {
  const [tab, setTab] = useState<"channels" | "categories">("channels");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ChannelSortKey>(DEFAULT_CHANNEL_SORT);
  const [pollTick, setPollTick] = useState(0);

  const [favCategories, setFavCategories] = useState<FavoriteCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setPollTick((c) => c + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/favorites", { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load favorites.");
      }

      setFavorites(payload.data ?? []);
      setError(null);
    } catch (fetchError) {
      if ((fetchError as Error).name !== "AbortError") {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load favorites.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadCategories = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/favorites/categories", { cache: "no-store", signal });
      const payload = await response.json();
      if (response.ok) {
        setFavCategories(payload.data ?? []);
      }
    } catch { /* ignore */ }
    finally {
      if (!signal?.aborted) {
        setLoadingCats(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    void loadCategories(controller.signal);
    return () => controller.abort();
  }, [load, loadCategories, pollTick]);

  useEffect(() => {
    const handler = () => { void load(); void loadCategories(); };
    window.addEventListener(FAVORITES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, handler);
  }, [load, loadCategories]);

  const liveFavorites = useMemo(
    () =>
      sortChannels(
        favorites.filter((favorite) => favorite.isLive),
        sortKey,
        (favorite) => favorite.broadcasterName,
        (favorite) => favorite.viewerCount ?? 0
      ),
    [favorites, sortKey]
  );
  const offlineFavorites = useMemo(
    () =>
      sortChannels(
        favorites.filter((favorite) => !favorite.isLive),
        sortKey,
        (favorite) => favorite.broadcasterName,
        () => null
      ),
    [favorites, sortKey]
  );

  const renderCard = (favorite: FavoriteItem) => (
    <StreamCard
      key={favorite.id}
      id={favorite.id}
      channelId={favorite.channelId}
      login={favorite.broadcasterLogin}
      displayName={favorite.broadcasterName}
      title={favorite.isLive ? favorite.title || "Live now" : "Offline"}
      viewerCount={favorite.isLive ? favorite.viewerCount ?? null : null}
      startedAt={favorite.startedAt}
      startedAtLabel={favorite.isLive ? "" : "Offline"}
      thumbnailUrl={buildLivePreviewUrl(favorite.broadcasterLogin)}
      categoryId={favorite.categoryId}
      categoryName={favorite.categoryName}
      url={favorite.url}
    />
  );

  return (
    <section className="stack-lg">
      <div className="panel">
        <h1>Favorites</h1>
      </div>

      <div className="segmented">
        <button
          className={tab === "channels" ? "segment active" : "segment"}
          onClick={() => setTab("channels")}
          type="button"
        >
          Channels
          {favorites.length > 0 ? <span className="pill" style={{ marginLeft: "6px" }}>{favorites.length}</span> : null}
        </button>
        <button
          className={tab === "categories" ? "segment active" : "segment"}
          onClick={() => setTab("categories")}
          type="button"
        >
          Categories
          {favCategories.length > 0 ? <span className="pill" style={{ marginLeft: "6px" }}>{favCategories.length}</span> : null}
        </button>
      </div>

      {tab === "categories" ? (
        favCategories.length > 0 ? (
          <div className="category-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 190px))" }}>
            {favCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                id={cat.categoryId}
                name={cat.categoryName}
                boxArtUrl={cat.boxArtUrl ?? ""}
              />
            ))}
          </div>
        ) : (
          !loadingCats ? <div className="panel muted">No favorite categories yet. Save them from any category page.</div> : <div className="pill">Loading categories</div>
        )
      ) : (
        <>
          {loading ? <div className="pill">Loading favorites</div> : null}
          {error ? <div className="error-box">{error}</div> : null}
          {favorites.length > 0 ? (
            <div className="list-toolbar">
              <ChannelSortSelect value={sortKey} onChange={setSortKey} ariaLabel="Sort favorites" />
            </div>
          ) : null}
          {liveFavorites.length > 0 ? (
            <div className="stack-sm">
              <div className="section-head">
                <h2>Live</h2>
                <span className="pill">{liveFavorites.length}</span>
              </div>
              <div className="stream-grid">{liveFavorites.map(renderCard)}</div>
            </div>
          ) : null}
          {offlineFavorites.length > 0 ? (
            <div className="stack-sm">
              <div className="section-head">
                <h2>Offline</h2>
                <span className="pill">{offlineFavorites.length}</span>
              </div>
              <div className="stream-grid">{offlineFavorites.map(renderCard)}</div>
            </div>
          ) : null}
          {!loading && !error && favorites.length === 0 ? (
            <div className="panel muted">Save channels from any stream card and they will show up here.</div>
          ) : null}
        </>
      )}
    </section>
  );
}
