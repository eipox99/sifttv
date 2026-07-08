"use client";

import { useSession } from "next-auth/react";
import { memo, useState, useTransition } from "react";

import { useFavorites } from "@/components/favorites-store";
import { emitFavoritesUpdated } from "@/lib/favorites-events";

type FavoriteButtonProps = {
  channelId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  compact?: boolean;
};

function FavoriteButtonComponent(props: FavoriteButtonProps) {
  const { data: session } = useSession();
  const favorites = useFavorites();
  const [pending, startTransition] = useTransition();
  const [fallbackFavorite, setFallbackFavorite] = useState(false);

  if (!session?.user) {
    return null;
  }

  const isFavorite = favorites ? favorites.isFavorite(props.channelId) : fallbackFavorite;

  const baseClass = props.compact ? "button button-secondary button-compact" : "button button-secondary";

  return (
    <button
      className={`${baseClass} favorite-button${isFavorite ? " is-favorite" : ""}`}
      disabled={pending}
      aria-pressed={isFavorite}
      onClick={() =>
        startTransition(async () => {
          if (isFavorite) {
            const response = await fetch(`/api/favorites/${props.channelId}`, {
              method: "DELETE"
            });

            if (response.ok) {
              favorites?.setLocalFavorite(props.channelId, false);
              setFallbackFavorite(false);
              emitFavoritesUpdated();
            }

            return;
          }

          const response = await fetch("/api/favorites", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(props)
          });

          if (response.ok) {
            favorites?.setLocalFavorite(props.channelId, true);
            setFallbackFavorite(true);
            emitFavoritesUpdated();
          }
        })
      }
    >
      <span className="favorite-star" aria-hidden="true">
        {isFavorite ? "★" : "☆"}
      </span>
      {pending
        ? "Saving"
        : props.compact
          ? isFavorite
            ? "Favorited"
            : "Favorite"
          : isFavorite
            ? "Remove favorite"
            : "Save favorite"}
    </button>
  );
}

export const FavoriteButton = memo(FavoriteButtonComponent);
