"use client";

import { useSession } from "next-auth/react";
import { memo, useState, useTransition } from "react";

import { useCategoryFavorites } from "@/components/category-favorites-store";
import { emitFavoritesUpdated } from "@/lib/favorites-events";

type CategoryFavoriteButtonProps = {
  categoryId: string;
  categoryName: string;
  boxArtUrl?: string | null;
};

function CategoryFavoriteButtonComponent(props: CategoryFavoriteButtonProps) {
  const { data: session } = useSession();
  const favorites = useCategoryFavorites();
  const [pending, startTransition] = useTransition();
  const [fallbackFavorite, setFallbackFavorite] = useState(false);

  if (!session?.user) {
    return null;
  }

  const isFavorite = favorites ? favorites.isFavorite(props.categoryId) : fallbackFavorite;

  return (
    <button
      className={`button button-secondary category-favorite-button${isFavorite ? " is-favorite" : ""}`}
      disabled={pending}
      aria-pressed={isFavorite}
      onClick={() =>
        startTransition(async () => {
          if (isFavorite) {
            const response = await fetch(`/api/favorites/categories/${props.categoryId}`, {
              method: "DELETE"
            });

            if (response.ok) {
              favorites?.setLocalFavorite(props.categoryId, false);
              setFallbackFavorite(false);
              emitFavoritesUpdated();
            }

            return;
          }

          const response = await fetch("/api/favorites/categories", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(props)
          });

          if (response.ok) {
            favorites?.setLocalFavorite(props.categoryId, true);
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
        : isFavorite
          ? "Remove favorite"
          : "Save category"}
    </button>
  );
}

export const CategoryFavoriteButton = memo(CategoryFavoriteButtonComponent);
