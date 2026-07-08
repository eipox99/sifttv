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

type FavoritesContextValue = {
  ready: boolean;
  isFavorite: (channelId: string) => boolean;
  setLocalFavorite: (channelId: string, value: boolean) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function useFavorites(): FavoritesContextValue | null {
  return useContext(FavoritesContext);
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
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
        const response = await fetch("/api/favorites", { cache: "no-store", signal });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: Array<{ channelId: string }> };
        setIds(new Set((payload.data ?? []).map((favorite) => favorite.channelId)));
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

  const setLocalFavorite = useCallback((channelId: string, value: boolean) => {
    setIds((current) => {
      const next = new Set(current);
      if (value) {
        next.add(channelId);
      } else {
        next.delete(channelId);
      }
      return next;
    });
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ready,
      isFavorite: (channelId: string) => ids.has(channelId),
      setLocalFavorite
    }),
    [ready, ids, setLocalFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}
