"use client";

import { useEffect, useMemo, useState } from "react";

import { ChannelSortSelect } from "@/components/channel-sort-select";
import { StreamCard } from "@/components/stream-card";
import { fetchSharedJson } from "@/lib/client-fetch";
import { DEFAULT_CHANNEL_SORT, sortChannels, type ChannelSortKey } from "@/lib/channel-sort";

type FollowedItem = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string | null;
  viewerCount: number | null;
  startedAt: string | null;
  startedAtLabel: string | null;
  language: string | null;
  thumbnailUrl: string;
  categoryId: string | null;
  categoryName: string | null;
  url: string;
  isLive: boolean;
};

export function FollowedLive() {
  const [channels, setChannels] = useState<FollowedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ChannelSortKey>(DEFAULT_CHANNEL_SORT);
  const [pollTick, setPollTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPollTick((c) => c + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchSharedJson<{ data?: FollowedItem[] }>("/api/followed/all", { signal: controller.signal })
      .then((payload) => {
        setChannels(payload.data ?? []);
      })
      .catch((fetchError) => {
        if ((fetchError as Error).name !== "AbortError") {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load followed channels.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [pollTick]);

  const liveChannels = useMemo(
    () =>
      sortChannels(
        channels.filter((channel) => channel.isLive),
        sortKey,
        (channel) => channel.displayName,
        (channel) => channel.viewerCount ?? 0
      ),
    [channels, sortKey]
  );
  const offlineChannels = useMemo(
    () =>
      sortChannels(
        channels.filter((channel) => !channel.isLive),
        sortKey,
        (channel) => channel.displayName,
        () => null
      ),
    [channels, sortKey]
  );

  const renderCard = (channel: FollowedItem) => (
    <StreamCard
      key={channel.id}
      id={channel.id}
      channelId={channel.channelId}
      login={channel.login}
      displayName={channel.displayName}
      title={channel.isLive ? channel.title || "Live now" : "Offline"}
      viewerCount={channel.isLive ? channel.viewerCount ?? null : null}
      startedAt={channel.startedAt}
      startedAtLabel={channel.isLive ? channel.startedAtLabel ?? "" : "Offline"}
      language={channel.language}
      thumbnailUrl={channel.thumbnailUrl}
      categoryId={channel.categoryId}
      categoryName={channel.categoryName}
      url={channel.url}
    />
  );

  return (
    <section className="stack-lg">
      <div className="panel">
        <h1>Followed</h1>
      </div>
      {loading ? <div className="pill">Loading followed channels</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {channels.length > 0 ? (
        <div className="list-toolbar">
          <ChannelSortSelect value={sortKey} onChange={setSortKey} ariaLabel="Sort followed channels" />
        </div>
      ) : null}
      {liveChannels.length > 0 ? (
        <div className="stack-sm">
          <div className="section-head">
            <h2>Live</h2>
            <span className="pill">{liveChannels.length}</span>
          </div>
          <div className="stream-grid">{liveChannels.map(renderCard)}</div>
        </div>
      ) : null}
      {offlineChannels.length > 0 ? (
        <div className="stack-sm">
          <div className="section-head">
            <h2>Offline</h2>
            <span className="pill">{offlineChannels.length}</span>
          </div>
          <div className="stream-grid">{offlineChannels.map(renderCard)}</div>
        </div>
      ) : null}
      {!loading && !error && channels.length === 0 ? (
        <div className="panel muted">You are not following any channels, or none could be loaded.</div>
      ) : null}
    </section>
  );
}
