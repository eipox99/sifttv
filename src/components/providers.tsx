"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Session } from "next-auth";

import { CategoryFavoritesProvider } from "@/components/category-favorites-store";
import { FavoritesProvider } from "@/components/favorites-store";
import { PreferencesProvider } from "@/components/preferences-store";
import { PlayerProvider } from "@/components/stream-player";
import type { PlaybackEngine } from "@/lib/preferences";

type ProvidersProps = {
  children: ReactNode;
  session: Session | null;
  playbackPreferences: {
    playbackEngine: PlaybackEngine;
    lowLatencyAutoFallback: boolean;
    lowLatencyCatchUp: boolean;
    autoOpenChat: boolean;
    chatAutoLogin: boolean;
    hoverPreview: boolean;
    mpegtsLowLatency: boolean;
    openInNewTab: boolean;
  };
};

export function Providers({ children, session, playbackPreferences }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <PreferencesProvider initial={playbackPreferences}>
        <FavoritesProvider>
          <CategoryFavoritesProvider>
            <PlayerProvider>{children}</PlayerProvider>
          </CategoryFavoritesProvider>
        </FavoritesProvider>
      </PreferencesProvider>
    </SessionProvider>
  );
}

