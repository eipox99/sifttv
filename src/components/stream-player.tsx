"use client";

import Hls from "hls.js";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { ChatEmbed, credentiallessSupported } from "@/components/chat-embed";
import { FavoriteButton } from "@/components/favorite-button";
import { usePreferences } from "@/components/preferences-store";
import { formatViewerCount } from "@/lib/formatters";
import type { PlaybackEngine } from "@/lib/preferences";

function formatLocalTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(iso));
}

function formatDuration(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < 0) return "0m";
  const totalMinutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type MpegtsPlayerInstance = {
  destroy(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  attachMediaElement(element: HTMLMediaElement): void;
  load(): void;
  play(): Promise<void> | void;
};

type WatchTarget = {
  login: string;
  displayName: string;
  channelId?: string | null;
  title?: string | null;
  categoryName?: string | null;
  categoryId?: string | null;
  thumbnailUrl?: string | null;
  url?: string | null;
};

type PlayerContextValue = {
  open: (target: WatchTarget) => void;
  close: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider.");
  }
  return context;
}

export function WatchOverlay(props: WatchTarget) {
  const { open } = usePlayer();
  const { openInNewTab } = usePreferences();

  return (
    <button
      type="button"
      className="stream-card-link"
      aria-label={`Watch ${props.displayName} in app`}
      onClick={() => {
        if (openInNewTab) {
          window.open(`/watch/${props.login}`, "_blank");
        } else {
          open(props);
        }
      }}
    />
  );
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<WatchTarget | null>(null);

  const open = useCallback((next: WatchTarget) => setTarget(next), []);
  const close = useCallback(() => setTarget(null), []);

  return (
    <PlayerContext.Provider value={{ open, close }}>
      {children}
      {target ? <StreamPlayerModal target={target} onClose={close} /> : null}
    </PlayerContext.Provider>
  );
}

type PlaybackState =
  | { status: "loading" }
  | { status: "playing" }
  | { status: "error"; message: string };

function formatQualityLabel(quality: string) {
  if (quality === "audio_only") return "Audio only";
  if (quality === "chunked") return "Source";
  return quality;
}

function qualityRank(quality: string) {
  if (quality === "audio_only") return -1;
  if (quality === "chunked" || quality === "source") return Number.MAX_SAFE_INTEGER;
  const match = quality.match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function buildQualityOptions(available: string[]) {
  const options: Array<{ value: string; label: string }> = [{ value: "best", label: "Auto (best)" }];
  const sorted = [...available].sort((a, b) => qualityRank(b) - qualityRank(a));
  for (const quality of sorted) {
    options.push({ value: quality, label: formatQualityLabel(quality) });
  }
  return options;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

const LIVE_EDGE_THRESHOLD_SECONDS = 8;

// How long playback may be frozen (currentTime not advancing while not paused)
// before we treat the stream as offline. A true freeze means the buffer has
// drained with no new data — i.e. the streamer stopped — as opposed to merely
// watching behind the live edge, where currentTime keeps advancing.
const OFFLINE_STALL_SECONDS = 12;

const LOW_LATENCY_SYNC_DURATION_COUNT = 2;
const LOW_LATENCY_MAX_PLAYBACK_RATE = 1.5;
const LOW_LATENCY_MAX_LATENCY_DURATION_COUNT = 5;
const DEFAULT_SYNC_DURATION_COUNT = 3;
const DEFAULT_MAX_PLAYBACK_RATE = 1;

// mpegts (low-latency) catch-up thresholds, in seconds behind the buffered live edge.
const MPEGTS_CATCHUP_TARGET_LATENCY = 1.2;
const MPEGTS_CATCHUP_MAX_LATENCY = 2.0;
const MPEGTS_CATCHUP_PLAYBACK_RATE = 1.2;
const MPEGTS_CATCHUP_SEEK_LATENCY = 4.0;
const MPEGTS_CATCHUP_MIN_REMAIN = 1.0;

function getLiveEdge(video: HTMLVideoElement, hls: Hls | null): number | null {
  if (hls && typeof hls.liveSyncPosition === "number" && Number.isFinite(hls.liveSyncPosition)) {
    return hls.liveSyncPosition;
  }

  if (video.seekable.length > 0) {
    return video.seekable.end(video.seekable.length - 1);
  }

  return null;
}

export function StreamPlayerModal({ target, onClose, standalone }: { target: WatchTarget; onClose: () => void; standalone?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<MpegtsPlayerInstance | null>(null);
  const { playbackEngine, lowLatencyAutoFallback, lowLatencyCatchUp, autoOpenChat, chatAutoLogin, mpegtsLowLatency: mpegtsLowLatencyPref } = usePreferences();
  const autoFallbackRef = useRef(lowLatencyAutoFallback);
  autoFallbackRef.current = lowLatencyAutoFallback;
  const [activeEngine, setActiveEngine] = useState<PlaybackEngine>(playbackEngine);
  const [state, setState] = useState<PlaybackState>({ status: "loading" });
  const statusRef = useRef<PlaybackState["status"]>("loading");
  statusRef.current = state.status;
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(autoOpenChat);
  const [chatLoggedIn, setChatLoggedIn] = useState(chatAutoLogin);
  const [credentiallessOk, setCredentiallessOk] = useState(true);
  const [quality, setQuality] = useState<string>("best");
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const qualityOptions = useMemo(
    () =>
      availableQualities.length > 0
        ? buildQualityOptions(availableQualities)
        : [{ value: "best", label: "Auto (best)" }],
    [availableQualities]
  );
  const [retryKey, setRetryKey] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const lastProgressRef = useRef<{ time: number; at: number } | null>(null);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);
  // Session-only catch-up state, seeded from the saved default each time the player opens.
  const [catchUp, setCatchUp] = useState(lowLatencyCatchUp);
  const catchUpRef = useRef(catchUp);
  catchUpRef.current = catchUp;
  const [lowLatency, setLowLatency] = useState(true);
  const lowLatencyRef = useRef(true);
  const [mpegtsLowLatency, setMpegtsLowLatency] = useState(mpegtsLowLatencyPref);
  const userPausedRef = useRef(false);

  const applyLatencyConfig = useCallback(() => {
    const hls = hlsRef.current;
    if (!hls) {
      return;
    }

    if (!lowLatencyRef.current) {
      hls.config.liveSyncDurationCount = DEFAULT_SYNC_DURATION_COUNT;
      hls.config.maxLiveSyncPlaybackRate = DEFAULT_MAX_PLAYBACK_RATE;
      hls.config.liveMaxLatencyDurationCount = Infinity;
      return;
    }

    hls.config.liveSyncDurationCount = LOW_LATENCY_SYNC_DURATION_COUNT;

    // When the viewer intentionally pauses, don't force catch-up or a seek to
    // the live edge on resume — let them continue from where they paused.
    if (userPausedRef.current) {
      hls.config.maxLiveSyncPlaybackRate = DEFAULT_MAX_PLAYBACK_RATE;
      hls.config.liveMaxLatencyDurationCount = Infinity;
      return;
    }

    hls.config.maxLiveSyncPlaybackRate = LOW_LATENCY_MAX_PLAYBACK_RATE;
    hls.config.liveMaxLatencyDurationCount = LOW_LATENCY_MAX_LATENCY_DURATION_COUNT;
  }, []);
  const [meta, setMeta] = useState<{
    displayName: string;
    title: string | null;
    categoryName: string | null;
    categoryId: string | null;
    channelId: string | null;
    thumbnailUrl: string | null;
    startedAt: string | null;
  }>({
    displayName: target.displayName,
    title: target.title ?? null,
    categoryName: target.categoryName ?? null,
    categoryId: target.categoryId ?? null,
    channelId: target.channelId ?? null,
    thumbnailUrl: target.thumbnailUrl ?? null,
    startedAt: null
  });

  useEffect(() => {
    setMeta({
      displayName: target.displayName,
      title: target.title ?? null,
      categoryName: target.categoryName ?? null,
      categoryId: target.categoryId ?? null,
      channelId: target.channelId ?? null,
      thumbnailUrl: target.thumbnailUrl ?? null,
      startedAt: null
    });

    const controller = new AbortController();

    fetch(`/api/streams/${target.login}/info`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data:
            | {
                displayName?: string | null;
                title?: string | null;
                categoryName?: string | null;
                categoryId?: string | null;
                channelId?: string | null;
                thumbnailUrl?: string | null;
                startedAt?: string | null;
              }
            | null
        ) => {
          if (!data) {
            return;
          }

          setMeta((current) => ({
            displayName: data.displayName || current.displayName,
            title: data.title ?? current.title,
            categoryName: data.categoryName ?? current.categoryName,
            categoryId: data.categoryId ?? current.categoryId,
            channelId: data.channelId ?? current.channelId,
            thumbnailUrl: data.thumbnailUrl ?? current.thumbnailUrl,
            startedAt: data.startedAt ?? current.startedAt
          }));
        }
      )
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [
    target.login,
    target.displayName,
    target.title,
    target.categoryName,
    target.categoryId,
    target.channelId,
    target.thumbnailUrl
  ]);

  useEffect(() => {
    const parent = window.location.hostname;
    setChatUrl(
      `https://www.twitch.tv/embed/${encodeURIComponent(target.login)}/chat?parent=${parent}&darkpopout`
    );
  }, [target.login]);

  useEffect(() => {
    const controller = new AbortController();
    setAvailableQualities([]);

    fetch(`/api/streams/${target.login}/qualities`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { qualities?: string[] } | null) => {
        if (data?.qualities) {
          setAvailableQualities(data.qualities);
        }
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [target.login, retryKey]);

  useEffect(() => {
    let cancelled = false;
    setViewerCount(null);

    const poll = async () => {
      try {
        const response = await fetch(`/api/streams/${target.login}/info`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { viewerCount?: number | null };
        if (!cancelled) {
          setViewerCount(typeof data.viewerCount === "number" ? data.viewerCount : null);
        }
      } catch {
        // transient failure; keep the last known count
      }
    };

    void poll();
    const interval = window.setInterval(poll, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [target.login]);

  // While in the error/offline state, periodically re-attempt to resolve the
  // stream. A successful resolve means the streamer is actually back on air, so
  // we rebuild the player. This tests real playability rather than viewer count.
  useEffect(() => {
    if (state.status !== "error") {
      return;
    }

    let cancelled = false;
    let interval: number | undefined;

    const check = async () => {
      if (cancelled) return;
      try {
        const response = await fetch(
          `/api/streams/${target.login}/playback?quality=${encodeURIComponent(quality)}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        // 200 => streamlink resolved a live stream, so the channel is back up.
        // Anything else (e.g. 409 offline) => keep waiting and retrying.
        if (response.ok) {
          setRetryKey((key) => key + 1);
        }
      } catch {
        // transient network issue; keep waiting
      }
    };

    void check();
    interval = window.setInterval(check, 10_000);

    return () => {
      cancelled = true;
      if (interval !== undefined) clearInterval(interval);
    };
  }, [state.status, target.login, quality]);

  useEffect(() => {
    setCredentiallessOk(credentiallessSupported());
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const focusable = Array.from(
        shell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    setActiveEngine(playbackEngine);
  }, [playbackEngine, target.login, quality, retryKey]);

  useEffect(() => {
    let cancelled = false;
    let hls: Hls | null = null;
    let mpegtsPlayer: MpegtsPlayerInstance | null = null;
    const controller = new AbortController();

    const failLowLatency = (message: string) => {
      if (cancelled) {
        return;
      }
      if (autoFallbackRef.current) {
        setActiveEngine("hls");
      } else {
        setState({ status: "error", message });
      }
    };

    async function startLowLatency(video: HTMLVideoElement) {
      try {
        const mpegtsModule = await import("mpegts.js");
        const mpegts = mpegtsModule.default;
        if (cancelled) {
          return;
        }

        if (!mpegts.isSupported() || !mpegts.getFeatureList().mseLivePlayback) {
          failLowLatency("Low-latency playback is not supported in this browser.");
          return;
        }

        const player = mpegts.createPlayer(
          {
            type: "mpegts",
            isLive: true,
            url: `${window.location.origin}/api/streams/${target.login}/ll?quality=${encodeURIComponent(quality)}&mpegts_ll=${mpegtsLowLatency ? "1" : "0"}`
          },
          {
            enableWorker: true,
            lazyLoad: false,
            // Catch-up is handled by our own controller (see the live-sync effect) so it
            // can be toggled on/off live from the player without recreating the stream.
            liveSync: false,
            liveBufferLatencyChasing: false
          }
        ) as unknown as MpegtsPlayerInstance;

        mpegtsPlayer = player;
        mpegtsRef.current = player;

        player.on(mpegts.Events.ERROR, () => {
          failLowLatency("Low-latency stream failed. Enable auto-fallback or switch to HLS in Settings.");
        });

        player.attachMediaElement(video);
        player.load();
        const playResult = player.play();
        if (playResult && typeof (playResult as Promise<void>).catch === "function") {
          (playResult as Promise<void>).catch(() => undefined);
        }

        if (!cancelled) {
          setState({ status: "playing" });
        }
      } catch {
        failLowLatency("Unable to start the low-latency player.");
      }
    }

    async function startHls(video: HTMLVideoElement) {
      try {
        const response = await fetch(
          `/api/streams/${target.login}/playback?quality=${encodeURIComponent(quality)}`,
          { signal: controller.signal }
        );
        const payload = (await response.json()) as { url?: string; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.url) {
          setState({ status: "error", message: payload.error ?? "Unable to load this stream." });
          return;
        }

        if (Hls.isSupported()) {
          hls = new Hls({ lowLatencyMode: true, enableWorker: true, liveSyncDurationCount: 3 });
          hlsRef.current = hls;
          applyLatencyConfig();
          hls.loadSource(payload.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            void video.play().catch(() => undefined);
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) {
              return;
            }

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls?.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls?.recoverMediaError();
            } else {
              setState({ status: "error", message: "Playback failed. The stream may have ended." });
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = payload.url;
          video.addEventListener("loadedmetadata", () => {
            void video.play().catch(() => undefined);
          });
        } else {
          setState({ status: "error", message: "Your browser cannot play this stream." });
          return;
        }

        setState({ status: "playing" });
      } catch (error) {
        if (!cancelled && (error as Error).name !== "AbortError") {
          setState({ status: "error", message: "Unable to reach the streaming server." });
        }
      }
    }

    async function start() {
      setState({ status: "loading" });
      userPausedRef.current = false;

      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (activeEngine === "lowlatency") {
        await startLowLatency(video);
      } else {
        await startHls(video);
      }
    }

    void start();

    return () => {
      cancelled = true;
      controller.abort();
      if (hls) {
        hls.destroy();
      }
      if (hlsRef.current === hls) {
        hlsRef.current = null;
      }
      if (mpegtsPlayer) {
        try {
          mpegtsPlayer.destroy();
        } catch {
          // player already torn down
        }
      }
      if (mpegtsRef.current === mpegtsPlayer) {
        mpegtsRef.current = null;
      }
    };
  }, [target.login, quality, retryKey, activeEngine, mpegtsLowLatency, applyLatencyConfig]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const update = () => {
      // Stream reached the end of its manifest (HLS ENDLIST) — e.g. the Twitch
      // reconnect slate finished, or the streamer stopped. `ended` is only true
      // here, never for a user pause, so treat it as offline and hand off to the
      // reconnect loop.
      if (video.ended) {
        setIsLive(false);
        if (statusRef.current === "playing") {
          lastProgressRef.current = null;
          setState({ status: "error", message: "Streamer went offline" });
        }
        return;
      }

      if (video.paused) {
        setIsLive(false);
        lastProgressRef.current = null;
        return;
      }

      const liveEdge = getLiveEdge(video, hlsRef.current);
      const live = liveEdge !== null && liveEdge - video.currentTime <= LIVE_EDGE_THRESHOLD_SECONDS;
      setIsLive(live);

      // Offline detection: if currentTime stops advancing while we're not paused,
      // the buffer has drained with no new data — the streamer went offline.
      // (Merely being behind the live edge keeps currentTime advancing, so this
      // won't false-trigger when watching behind live.)
      const now = Date.now();
      const currentTime = video.currentTime;
      const prev = lastProgressRef.current;
      if (!prev || currentTime > prev.time + 0.25) {
        lastProgressRef.current = { time: currentTime, at: now };
      } else if (
        statusRef.current === "playing" &&
        now - prev.at >= OFFLINE_STALL_SECONDS * 1000
      ) {
        lastProgressRef.current = null;
        setState({ status: "error", message: "Streamer went offline" });
      }
    };

    const events: Array<keyof HTMLMediaElementEventMap> = [
      "play",
      "pause",
      "playing",
      "timeupdate",
      "seeking",
      "seeked",
      "waiting",
      "ended",
      "emptied"
    ];

    events.forEach((event) => video.addEventListener(event, update));
    const interval = window.setInterval(update, 1000);
    update();

    return () => {
      events.forEach((event) => video.removeEventListener(event, update));
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const update = () => setVideoHeight(video.videoHeight > 0 ? video.videoHeight : null);
    const events: Array<keyof HTMLMediaElementEventMap> = ["loadedmetadata", "resize", "playing"];

    events.forEach((event) => video.addEventListener(event, update));
    update();

    return () => {
      events.forEach((event) => video.removeEventListener(event, update));
    };
  }, [activeEngine, quality, retryKey]);

  useEffect(() => {
    lowLatencyRef.current = lowLatency;
    applyLatencyConfig();
  }, [lowLatency, applyLatencyConfig]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onPause = () => {
      userPausedRef.current = true;
      applyLatencyConfig();
    };

    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("pause", onPause);
    };
  }, [applyLatencyConfig]);

  // Low-latency (mpegts) catch-up: nudge playbackRate up to drift back toward the live
  // edge, and hard-seek if we fall far behind. Reads catchUpRef so it can be toggled live.
  useEffect(() => {
    if (activeEngine !== "lowlatency") {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const tick = () => {
      if (!catchUpRef.current || userPausedRef.current || video.paused || video.seeking) {
        if (video.playbackRate !== 1) {
          video.playbackRate = 1;
        }
        return;
      }

      const buffered = video.buffered;
      if (buffered.length === 0) {
        return;
      }

      const bufferedEnd = buffered.end(buffered.length - 1);
      const latency = bufferedEnd - video.currentTime;

      if (latency > MPEGTS_CATCHUP_SEEK_LATENCY) {
        try {
          video.currentTime = bufferedEnd - MPEGTS_CATCHUP_MIN_REMAIN;
        } catch {
          // seeking may fail transiently; ignore
        }
        video.playbackRate = 1;
        return;
      }

      if (latency > MPEGTS_CATCHUP_MAX_LATENCY) {
        if (video.playbackRate !== MPEGTS_CATCHUP_PLAYBACK_RATE) {
          video.playbackRate = MPEGTS_CATCHUP_PLAYBACK_RATE;
        }
      } else if (latency < MPEGTS_CATCHUP_TARGET_LATENCY && video.playbackRate !== 1) {
        video.playbackRate = 1;
      }
    };

    video.addEventListener("timeupdate", tick);
    const interval = window.setInterval(tick, 1000);

    return () => {
      video.removeEventListener("timeupdate", tick);
      window.clearInterval(interval);
      video.playbackRate = 1;
    };
  }, [activeEngine, retryKey, quality]);

  const syncToLive = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    userPausedRef.current = false;
    applyLatencyConfig();

    const liveEdge = getLiveEdge(video, hlsRef.current);
    if (liveEdge !== null) {
      video.currentTime = liveEdge;
    }

    void video.play().catch(() => undefined);
  }, [applyLatencyConfig]);

  return (
    <div
      className={standalone ? "player-standalone" : "player-overlay"}
      role={standalone ? undefined : "dialog"}
      aria-modal={standalone ? undefined : "true"}
      aria-label={standalone ? undefined : `${target.displayName} stream`}
      onClick={standalone ? undefined : onClose}
    >
      <div className={standalone ? "player-shell player-shell-standalone" : "player-shell"} ref={shellRef} onClick={(event) => event.stopPropagation()}>
        <div className={`player-stage${chatOpen ? "" : " player-stage-no-chat"}`}>
          <div className="player-video-wrapper">
            <video ref={videoRef} className="player-video" controls autoPlay playsInline />
            {state.status === "loading" ? <div className="player-status">Loading stream…</div> : null}
            {state.status === "error" ? (
              <div className="player-status player-status-error">
                <span>{state.message}</span>
                <button
                  className="button button-secondary button-compact"
                  onClick={() => setRetryKey((key) => key + 1)}
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
          {chatOpen && chatUrl ? (
            <div className="player-chat-panel">
              <div className="player-chat-bar">
                <span className="player-chat-mode">
                  {chatLoggedIn
                    ? "Logged in"
                    : credentiallessOk
                      ? "Anonymous · read-only"
                      : "Anonymous unavailable in this browser"}
                </span>
                <button
                  type="button"
                  className="button button-secondary button-compact"
                  onClick={() => setChatLoggedIn((current) => !current)}
                  title={
                    chatLoggedIn
                      ? "Switch to anonymous read-only chat"
                      : "Load chat with your Twitch session so you can talk"
                  }
                >
                  {chatLoggedIn ? "Read anonymously" : "Log in to chat"}
                </button>
              </div>
              <ChatEmbed
                key={chatLoggedIn ? "authed" : "anon"}
                src={chatUrl}
                anonymous={!chatLoggedIn}
                title={`${meta.displayName} chat`}
              />
            </div>
          ) : null}
        </div>
        <div className="player-info">
          <div className="player-info-meta">
            <div className="player-info-title">
              <span className="player-name">{meta.displayName}</span>
              {meta.title ? <span className="player-title"> - {meta.title}</span> : null}
            </div>
            {meta.categoryName ? (
              meta.categoryId ? (
                <Link
                  href={`/category/${meta.categoryId}`}
                  className="player-category player-category-link"
                  onClick={onClose}
                >
                  {meta.categoryName}
                </Link>
              ) : (
                <span className="player-category">{meta.categoryName}</span>
              )
            ) : null}
            {meta.startedAt ? (
              <span className="player-started-at">
                Started {formatLocalTime(meta.startedAt)}
              </span>
            ) : null}
          </div>
          <div className="player-actions">
            {meta.startedAt ? (
              <span className="player-duration" title="Stream duration">
                {formatDuration(meta.startedAt)}
              </span>
            ) : null}
            {viewerCount !== null ? (
              <span className="player-viewers" title="Current viewers">
                <span className="player-viewers-dot" />
                {formatViewerCount(viewerCount)}
              </span>
            ) : null}
            <button
              type="button"
              className={`player-live ${isLive ? "player-live-on" : "player-live-off"}`}
              onClick={syncToLive}
              aria-label={isLive ? "Watching live" : "Jump to live"}
              title={isLive ? "You are watching live" : "Click to jump to live"}
            >
              <span className="player-live-dot" />
              LIVE
            </button>
            {activeEngine === "lowlatency" ? (
              <button
                type="button"
                className={`player-toggle ${mpegtsLowLatency ? "player-toggle-on" : ""}`}
                onClick={() => setMpegtsLowLatency((current) => !current)}
                aria-pressed={mpegtsLowLatency}
                title="Pass --twitch-low-latency to streamlink (less delay, may buffer more)"
              >
                mpegts{mpegtsLowLatency ? ": Low latency" : ""}
              </button>
            ) : (
              <button
                type="button"
                className={`player-toggle ${lowLatency ? "player-toggle-on" : ""}`}
                onClick={() => setLowLatency((current) => !current)}
                aria-pressed={lowLatency}
                title="Reduce delay to be closer to real time (may buffer more on slow connections)"
              >
                Low latency{lowLatency ? ": On" : ": Off"}
              </button>
            )}
            {activeEngine === "lowlatency" ? (
              <button
                type="button"
                className={`player-toggle ${catchUp ? "player-toggle-on" : ""}`}
                onClick={() => setCatchUp((current) => !current)}
                aria-pressed={catchUp}
                title="Automatically catch up to the live edge (speed up slightly, and skip ahead if far behind). Applies to this session only."
              >
                Catch-up{catchUp ? ": On" : ": Off"}
              </button>
            ) : null}
            <label className="player-quality">
              <span className="player-quality-label">Quality</span>
              <select
                className="text-input compact-input select-input"
                value={quality}
                onChange={(event) => setQuality(event.target.value)}
                aria-label="Stream quality"
              >
                {qualityOptions.map((option) => {
                  const label =
                    option.value === "best" && quality === "best" && videoHeight
                      ? `Auto (${videoHeight}p)`
                      : option.label;

                  return (
                    <option key={option.value} value={option.value}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="button"
              className={`player-toggle ${chatOpen ? "player-toggle-on" : ""}`}
              onClick={() => setChatOpen((current) => !current)}
              aria-pressed={chatOpen}
              title={chatOpen ? "Hide chat" : "Show chat"}
            >
              Chat{chatOpen ? ": On" : ": Off"}
            </button>
            {meta.channelId ? (
              <FavoriteButton
                channelId={meta.channelId}
                broadcasterLogin={target.login}
                broadcasterName={meta.displayName}
                thumbnailUrl={meta.thumbnailUrl}
                categoryId={meta.categoryId}
                categoryName={meta.categoryName}
                compact
              />
            ) : null}
            {target.url ? (
              <a className="button button-secondary button-compact" href={target.url} target="_blank" rel="noreferrer" title="Open on Twitch" aria-label="Open on Twitch">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: "block" }}>
                  <path d="M11.571 4.714h1.715v5.143H11.57Zm4.715 0H18v5.143h-1.714ZM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0ZM20.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
              </a>
            ) : null}
            <button
              ref={closeButtonRef}
              className="button button-secondary button-compact"
              onClick={onClose}
              aria-label="Close player"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
