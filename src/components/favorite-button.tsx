"use client";

import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";

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

export function FavoriteButton(props: FavoriteButtonProps) {
  const { data: session } = useSession();
  const [isFavorite, setIsFavorite] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!session?.user) {
    return null;
  }

  return (
    <button
      className={props.compact ? "button button-secondary button-compact" : "button button-secondary"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (isFavorite) {
            const response = await fetch(`/api/favorites/${props.channelId}`, {
              method: "DELETE"
            });

            if (response.ok) {
              setIsFavorite(false);
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
            setIsFavorite(true);
            emitFavoritesUpdated();
          }
        })
      }
    >
      {pending
        ? "Saving"
        : props.compact
          ? isFavorite
            ? "Saved"
            : "Favorite"
          : isFavorite
            ? "Remove favorite"
            : "Save favorite"}
    </button>
  );
}
