"use client";

import type { ReactNode } from "react";

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

function SettingRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <span className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        <span className="settings-row-desc">{description}</span>
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch-slider" />
      </span>
    </label>
  );
}

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
        <h1>Settings</h1>
        <p className="muted">
          Personalize playback, chat, and browsing. Playback changes apply the next time you open a stream.
        </p>
      </div>

      <div className="panel settings-group">
        <div className="settings-group-header">
          <h2>Playback</h2>
          <p className="muted">How streams are played inside the in-app player.</p>
        </div>

        <div className="settings-field">
          <span className="settings-field-label">Default player</span>
          <span className="settings-field-desc">The engine used when you open a stream.</span>
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
                  {option.value === "lowlatency" ? (
                    <span className="pill settings-default-pill">Default</span>
                  ) : null}
                </span>
                <span className="settings-option-desc">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-rows">
          <SettingRow
            label="Auto-fallback to HLS on error"
            description="If the low-latency player fails to start or errors mid-stream, automatically switch to the HLS player."
            checked={lowLatencyAutoFallback}
            onChange={setLowLatencyAutoFallback}
          />
          <SettingRow
            label="Catch up to the live edge by default"
            description="For the low-latency (mpegts) player: when playback drifts behind, gradually speed up — and skip ahead if it falls far behind — to stay near real time. You can still override this per-stream in the player."
            checked={lowLatencyCatchUp}
            onChange={setLowLatencyCatchUp}
          />
          <SettingRow
            label="Low-latency mode for mpegts"
            description={
              <>
                Passes <code>--twitch-low-latency</code> to Streamlink when using the mpegts player. Reduces delay but
                may cause more buffering. Also toggleable per-session in the player.
              </>
            }
            checked={mpegtsLowLatency}
            onChange={setMpegtsLowLatency}
          />
        </div>
      </div>

      <div className="panel settings-group">
        <div className="settings-group-header">
          <h2>Chat</h2>
          <p className="muted">Twitch chat behavior alongside the stream.</p>
        </div>

        <div className="settings-rows">
          <SettingRow
            label="Open chat automatically"
            description="Open Twitch chat next to the stream when you start watching. When off, chat isn't loaded at all — so you aren't connected to the channel's chat — and you can open it any time from the player."
            checked={autoOpenChat}
            onChange={setAutoOpenChat}
          />
          <SettingRow
            label="Auto login to chat"
            description="When off, chat opens anonymously (read-only) so you aren't shown as watching. Use the “Log in to chat” button in the player when you want to chat as yourself."
            checked={chatAutoLogin}
            onChange={setChatAutoLogin}
          />
        </div>
      </div>

      <div className="panel settings-group">
        <div className="settings-group-header">
          <h2>Browsing</h2>
          <p className="muted">How stream cards behave while browsing.</p>
        </div>

        <div className="settings-rows">
          <SettingRow
            label="Show preview thumbnail on hover"
            description="Shows a larger thumbnail preview when hovering over a stream card's thumbnail."
            checked={hoverPreview}
            onChange={setHoverPreview}
          />
          <SettingRow
            label="Open streams in a new tab"
            description="Clicking a stream card opens the player in a new browser tab instead of the in-page overlay."
            checked={openInNewTab}
            onChange={setOpenInNewTab}
          />
        </div>
      </div>
    </section>
  );
}
