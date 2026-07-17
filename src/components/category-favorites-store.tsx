"use client";

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { FAVORITES_UPDATED_EVENT } from "@/lib/favorites-events";

type CategoryFavoritesContextValue = {
  ready: boolean;
  isFavorite: (categoryId: string) => boolean;
  setLocalFavorite: (categoryId: string, value: boolean) => void;
};

const CategoryFavoritesContext = createContext<CategoryFavoritesContextValue | null>(null);

export function useCategoryFavorites(): CategoryFavoritesContextValue | null {
  return useContext(CategoryFavoritesContext);
}

export function CategoryFavoritesProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) {
        setIds(new Set());
        setReady(true);
        return;
      }

      try {
        const response = await fetch("/api/favorites/categories", { cache: "no-store", signal });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: Array<{ categoryId: string }> };
        setIds(new Set((payload.data ?? []).map((fav) => fav.categoryId)));
        setReady(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setReady(true);
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener(FAVORITES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, handler);
  }, [load]);

  const setLocalFavorite = useCallback((categoryId: string, value: boolean) => {
    setIds((current) => {
      const next = new Set(current);
      if (value) {
        next.add(categoryId);
      } else {
        next.delete(categoryId);
      }
      return next;
    });
  }, []);

  const value = useMemo<CategoryFavoritesContextValue>(
    () => ({
      ready,
      isFavorite: (categoryId: string) => ids.has(categoryId),
      setLocalFavorite
    }),
    [ready, ids, setLocalFavorite]
  );

  return <CategoryFavoritesContext.Provider value={value}>{children}</CategoryFavoritesContext.Provider>;
}
