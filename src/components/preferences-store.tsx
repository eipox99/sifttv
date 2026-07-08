"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import type { PlaybackEngine } from "@/lib/preferences";

type PlaybackPreferences = {
  playbackEngine: PlaybackEngine;
  lowLatencyAutoFallback: boolean;
  lowLatencyCatchUp: boolean;
  autoOpenChat: boolean;
  chatAutoLogin: boolean;
  hoverPreview: boolean;
  mpegtsLowLatency: boolean;
  openInNewTab: boolean;
};

type PreferencesContextValue = PlaybackPreferences & {
  setPlaybackEngine: (engine: PlaybackEngine) => void;
  setLowLatencyAutoFallback: (enabled: boolean) => void;
  setLowLatencyCatchUp: (enabled: boolean) => void;
  setAutoOpenChat: (enabled: boolean) => void;
  setChatAutoLogin: (enabled: boolean) => void;
  setHoverPreview: (enabled: boolean) => void;
  setMpegtsLowLatency: (enabled: boolean) => void;
  setOpenInNewTab: (enabled: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider.");
  }
  return context;
}

async function persist(body: Record<string, unknown>) {
  try {
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    // best-effort; the in-memory value still applies for this session
  }
}

export function PreferencesProvider({
  children,
  initial
}: {
  children: ReactNode;
  initial: PlaybackPreferences;
}) {
  const [playbackEngine, setPlaybackEngineState] = useState<PlaybackEngine>(initial.playbackEngine);
  const [lowLatencyAutoFallback, setLowLatencyAutoFallbackState] = useState<boolean>(
    initial.lowLatencyAutoFallback
  );
  const [lowLatencyCatchUp, setLowLatencyCatchUpState] = useState<boolean>(initial.lowLatencyCatchUp);
  const [autoOpenChat, setAutoOpenChatState] = useState<boolean>(initial.autoOpenChat);
  const [chatAutoLogin, setChatAutoLoginState] = useState<boolean>(initial.chatAutoLogin);
  const [hoverPreview, setHoverPreviewState] = useState<boolean>(initial.hoverPreview);
  const [mpegtsLowLatency, setMpegtsLowLatencyState] = useState<boolean>(initial.mpegtsLowLatency);
  const [openInNewTab, setOpenInNewTabState] = useState<boolean>(initial.openInNewTab);

  const setPlaybackEngine = useCallback((engine: PlaybackEngine) => {
    setPlaybackEngineState(engine);
    void persist({ playbackEngine: engine });
  }, []);

  const setLowLatencyAutoFallback = useCallback((enabled: boolean) => {
    setLowLatencyAutoFallbackState(enabled);
    void persist({ lowLatencyAutoFallback: enabled });
  }, []);

  const setLowLatencyCatchUp = useCallback((enabled: boolean) => {
    setLowLatencyCatchUpState(enabled);
    void persist({ lowLatencyCatchUp: enabled });
  }, []);

  const setAutoOpenChat = useCallback((enabled: boolean) => {
    setAutoOpenChatState(enabled);
    void persist({ autoOpenChat: enabled });
  }, []);

  const setChatAutoLogin = useCallback((enabled: boolean) => {
    setChatAutoLoginState(enabled);
    void persist({ chatAutoLogin: enabled });
  }, []);

  const setHoverPreview = useCallback((enabled: boolean) => {
    setHoverPreviewState(enabled);
    void persist({ hoverPreview: enabled });
  }, []);

  const setMpegtsLowLatency = useCallback((enabled: boolean) => {
    setMpegtsLowLatencyState(enabled);
    void persist({ mpegtsLowLatency: enabled });
  }, []);

  const setOpenInNewTab = useCallback((enabled: boolean) => {
    setOpenInNewTabState(enabled);
    void persist({ openInNewTab: enabled });
  }, []);

  return (
    <PreferencesContext.Provider
      value={{
        playbackEngine,
        lowLatencyAutoFallback,
        lowLatencyCatchUp,
        autoOpenChat,
        chatAutoLogin,
        hoverPreview,
        mpegtsLowLatency,
        openInNewTab,
        setPlaybackEngine,
        setLowLatencyAutoFallback,
        setLowLatencyCatchUp,
        setAutoOpenChat,
        setChatAutoLogin,
        setHoverPreview,
        setMpegtsLowLatency,
        setOpenInNewTab
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
