"use client";

import { useEffect, useState } from "react";

import { StreamCard } from "@/components/stream-card";

type StreamItem = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  startedAtLabel: string;
  language: string;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
  url: string;
};

export function FollowedLive() {
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/followed/live", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load followed live.");
        }

        if (active) {
          setStreams(payload.data ?? []);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load followed live.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="stack-lg">
      <div className="panel">
        <p className="eyebrow">Signed-in feed</p>
        <h1>Followed live streams</h1>
        <p className="muted">
          This uses your Twitch OAuth session and the <code>user:read:follows</code> scope.
        </p>
      </div>
      {loading ? <div className="pill">Loading followed live</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      <div className="stream-grid">
        {streams.map((stream) => (
          <StreamCard key={stream.id} {...stream} />
        ))}
      </div>
      {!loading && !error && streams.length === 0 ? (
        <div className="panel muted">No followed channels are live right now.</div>
      ) : null}
    </section>
  );
}

