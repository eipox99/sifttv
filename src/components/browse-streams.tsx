"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StreamCard } from "@/components/stream-card";
import { formatLanguageLabel, normalizeLanguageCode } from "@/lib/formatters";
import { CATEGORY_STREAM_BATCH_SIZE } from "@/lib/pagination";

type StreamData = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number | null;
  startedAt: string;
  startedAtLabel: string;
  language: string;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
};

type BrowseStreamsProps = {
  initialStreams: StreamData[];
  initialCursor: string | null;
};

export function BrowseStreams({ initialStreams, initialCursor }: BrowseStreamsProps) {
  const [streams, setStreams] = useState<StreamData[]>(initialStreams);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  const availableLanguages = useMemo(() => {
    const codes = new Set(streams.map((s) => normalizeLanguageCode(s.language)).filter(Boolean) as string[]);
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [streams]);

  const fetchPage = useCallback(async (pageCursor: string, pageLanguage: string, replace: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams({ limit: String(CATEGORY_STREAM_BATCH_SIZE) });
      if (pageCursor) params.set("cursor", pageCursor);
      if (pageLanguage) params.set("language", pageLanguage);

      const response = await fetch(`/api/streams/all?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) return;

      const next: StreamData[] = payload.data ?? [];
      const nextCursor = payload.cursor ?? null;

      if (replace) {
        setStreams(next);
      } else if (next.length > 0) {
        setStreams((current) => {
          const seen = new Set(current.map((s) => s.id));
          const merged = [...current];
          for (const stream of next) {
            if (!seen.has(stream.id)) merged.push(stream);
          }
          return merged;
        });
      }
      setCursor(nextCursor);
    } catch {
      // transient
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  // When the language changes, start a fresh fetch from the beginning.
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      return;
    }
    inFlightRef.current = false;
    setCursor(null);
    setStreams([]);
    void fetchPage("", language, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Infinite scroll: load more pages when the sentinel comes into view.
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !cursor || loading) return;

    const handler = () => {
      void fetchPage(cursor, language, false);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) handler();
      },
      { rootMargin: "900px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loading, language, fetchPage]);

  return (
    <section className="stack-lg">
      <div className="panel">
        <p className="eyebrow">Browse</p>
        <div className="hero-controls">
          <h1>All streams</h1>
          {availableLanguages.length > 0 ? (
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="text-input text-input-sm"
            >
              <option value="">All languages</option>
              {availableLanguages.map((code) => (
                <option key={code} value={code}>
                  {formatLanguageLabel(code)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {streams.length > 0 ? (
        <div className="category-grid">
          {streams.map((stream) => (
            <StreamCard
              key={stream.id}
              {...stream}
              url={`https://www.twitch.tv/${stream.login}`}
            />
          ))}
        </div>
      ) : loading ? null : (
        <p className="muted">No live streams match the selected filter.</p>
      )}

      {cursor ? (
        <div ref={loadMoreRef} className="stream-load-sentinel">
          {loading ? "Loading more streams" : "Scroll to load more"}
        </div>
      ) : streams.length > 36 ? (
        <div className="stream-load-sentinel">All loaded</div>
      ) : null}
    </section>
  );
}
