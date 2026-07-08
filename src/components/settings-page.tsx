"use client";

import { usePreferences } from "@/components/preferences-store";
import type { PlaybackEngine } from "@/lib/preferences";

const ENGINE_OPTIONS: Array<{ value: PlaybackEngine; label: string; description: string }> = [
  {
    value: "lowlatency",
    label: "Low latency (mpegts)",
    description:
      "Streams through Streamlink's low-latency mode and plays it with mpegts.js. Closer to real time (~1-3s), but uses more server resources and only helps when the broadcaster enabled low latency."
  },
  {
    value: "hls",
    label: "HLS (stable)",
    description: "Plays Twitch's HLS stream directly with hls.js. Most reliable, ~4-10s behind live."
  }
];

export function SettingsPage() {
  const {
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
  } = usePreferences();

  return (
    <section className="stack-lg">
      <div className="panel">
        <p className="eyebrow">Settings</p>
        <h1>Playback</h1>
        <p className="muted">Choose how streams are played inside the app. Changes apply the next time you open a stream.</p>
      </div>

      <div className="stack-md">
        <div>
          <h2>Default player</h2>
          <p className="muted">The engine used when you open a stream in the in-app player.</p>
        </div>
        <div className="settings-options">
          {ENGINE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`settings-option${playbackEngine === option.value ? " is-selected" : ""}`}
              aria-pressed={playbackEngine === option.value}
              onClick={() => setPlaybackEngine(option.value)}
            >
              <span className="settings-option-title">
                {option.label}
                {option.value === "lowlatency" ? <span className="pill settings-default-pill">Default</span> : null}
              </span>
              <span className="settings-option-desc">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="stack-md">
        <div>
          <h2>Low-latency fallback</h2>
          <p className="muted">
            If the low-latency player fails to start or errors mid-stream, automatically fall back to the HLS player.
          </p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={lowLatencyAutoFallback}
            onChange={(event) => setLowLatencyAutoFallback(event.target.checked)}
          />
          <span>Auto-fallback to HLS on error</span>
        </label>
      </div>

      <div className="stack-md">
        <div>
          <h2>Low-latency catch-up</h2>
          <p className="muted">
            Sets the default for the low-latency (mpegts) player: when playback drifts behind, gradually speed up — and
            skip ahead if it falls far behind — to stay near real time. Turn off for a steadier buffer that may sit
            further behind live. You can still override this per-stream with the Catch-up button in the player.
          </p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={lowLatencyCatchUp}
            onChange={(event) => setLowLatencyCatchUp(event.target.checked)}
          />
          <span>Catch up to the live edge by default</span>
        </label>
      </div>

      <div className="stack-md">
        <div>
          <h2>Chat</h2>
          <p className="muted">
            Automatically open Twitch chat next to the stream when you start watching. When off, chat is not loaded at
            all (so you are not connected to the channel&apos;s chat), and you can open it any time from the button in
            the player.
          </p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={autoOpenChat}
            onChange={(event) => setAutoOpenChat(event.target.checked)}
          />
          <span>Open chat automatically with the stream</span>
        </label>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={chatAutoLogin}
            onChange={(event) => setChatAutoLogin(event.target.checked)}
          />
          <span>Auto login to chat</span>
        </label>
        <p className="muted">
          When off, chat opens anonymously (read-only) using your Twitch session&apos;s logged-out view, so you are not
          shown as watching. Use the &quot;Log in to chat&quot; button in the player when you want to chat as yourself.
        </p>
      </div>

      <div className="stack-md">
        <div>
          <h2>Hover preview</h2>
          <p className="muted">
            Shows a larger thumbnail preview when hovering over a stream card.
          </p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={hoverPreview}
            onChange={(event) => setHoverPreview(event.target.checked)}
          />
          <span>Show preview thumbnail on hover</span>
        </label>
      </div>

      <div className="stack-md">
        <div>
          <h2>mpegts low latency</h2>
          <p className="muted">
            Passes <code>--twitch-low-latency</code> to streamlink when using the mpegts player. Reduces delay but may
            cause more buffering. You can also toggle this per-session from the player.
          </p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={mpegtsLowLatency}
            onChange={(event) => setMpegtsLowLatency(event.target.checked)}
          />
          <span>Enable low-latency mode for mpegts</span>
        </label>
      </div>

      <div className="stack-md">
        <div>
          <h2>Open in new tab</h2>
          <p className="muted">
            When enabled, clicking a stream card opens the player in a new browser tab instead of the in-page overlay.
          </p>
        </div>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={openInNewTab}
            onChange={(event) => setOpenInNewTab(event.target.checked)}
          />
          <span>Open streams in a new tab</span>
        </label>
      </div>
    </section>
  );
}
