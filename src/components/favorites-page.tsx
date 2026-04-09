"use client";

import { useEffect, useState } from "react";

import { emitFavoritesUpdated } from "@/lib/favorites-events";

type FavoriteItem = {
  id: string;
  channelId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  thumbnailUrl?: string | null;
  categoryName?: string | null;
  url: string;
};

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

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
      .catch((fetchError) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load favorites.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function removeFavorite(channelId: string) {
    const response = await fetch(`/api/favorites/${channelId}`, {
      method: "DELETE"
    });

    if (response.ok) {
      setFavorites((current) => current.filter((favorite) => favorite.channelId !== channelId));
      emitFavoritesUpdated();
    }
  }

  return (
    <section className="stack-lg">
      <div className="panel">
        <p className="eyebrow">App-local follows</p>
        <h1>Favorites</h1>
        <p className="muted">
          These are saved only inside this app. They do not change who you follow on Twitch.
        </p>
      </div>
      {loading ? <div className="pill">Loading favorites</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <div className="favorites-grid">
        {favorites.map((favorite) => (
          <article key={favorite.id} className="favorite-card">
            {favorite.thumbnailUrl ? <img src={favorite.thumbnailUrl} alt={favorite.broadcasterName} /> : null}
            <div className="stack-sm">
              <div className="eyebrow">{favorite.categoryName ?? "Saved channel"}</div>
              <h3>{favorite.broadcasterName}</h3>
              <a href={favorite.url} target="_blank" rel="noreferrer" className="button button-primary">
                Open on Twitch
              </a>
              <button className="button button-secondary" onClick={() => void removeFavorite(favorite.channelId)}>
                Remove favorite
              </button>
            </div>
          </article>
        ))}
      </div>
      {!loading && !error && favorites.length === 0 ? (
        <div className="panel muted">Save channels from any stream card and they will show up here.</div>
      ) : null}
    </section>
  );
}
