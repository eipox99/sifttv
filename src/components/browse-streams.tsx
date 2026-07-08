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
  initialAvailableLanguages: string[];
};

export function BrowseStreams({ initialStreams, initialCursor, initialAvailableLanguages }: BrowseStreamsProps) {
  const [sort, setSort] = useState<"popular" | "low_to_high_exact">("popular");
  const [streams, setStreams] = useState<StreamData[]>(initialStreams);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [nextExactOffset, setNextExactOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("");
  const persistedRef = useRef(false);

  // Hydrate language/sort from localStorage after mount (SSR doesn't have it).
  // Must use handleLanguageChange so streams are re-fetched for the language.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    try {
      const savedLang = window.localStorage.getItem("browseLanguage");
      const savedSort = window.localStorage.getItem("browseSort");

      if (savedLang !== null && savedLang !== "") {
        handleLanguageChange(savedLang);
        return;
      }
      if (savedSort === "popular" || savedSort === "low_to_high_exact") {
        setSort(savedSort);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist language/sort across navigations.
  useEffect(() => {
    try {
      window.localStorage.setItem("browseLanguage", language);
    } catch { /* ignore */ }
  }, [language]);
  useEffect(() => {
    try {
      window.localStorage.setItem("browseSort", sort);
    } catch { /* ignore */ }
  }, [sort]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  const availableLanguages = useMemo(() => {
    const codes = new Set(initialAvailableLanguages);
    for (const stream of streams) {
      const code = normalizeLanguageCode(stream.language);
      if (code) codes.add(code);
    }
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [initialAvailableLanguages, streams]);

  const fetchPopular = useCallback(async (pageCursor: string, pageLanguage: string, replace: boolean) => {
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
      setCursor(payload.cursor ?? null);
    } catch {
      // transient
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const fetchExact = useCallback(async (offset: number, pageLanguage: string, replace: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        language: pageLanguage,
        offset: String(offset),
        limit: String(CATEGORY_STREAM_BATCH_SIZE)
      });

      const response = await fetch(`/api/streams/all/exact?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) return;

      const next: StreamData[] = payload.data ?? [];
      setNextExactOffset(payload.nextOffset ?? null);

      if (replace) {
        setStreams(next);
      } else {
        setStreams((current) => [...current, ...next]);
      }
    } catch {
      // transient
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const handleLanguageChange = useCallback((nextLanguage: string) => {
    setLanguage(nextLanguage);
    setSort("popular");
    inFlightRef.current = false;
    setCursor(initialCursor);
    setStreams([]);
    if (!nextLanguage) {
      // No filter — start from the same initial SSR position.
      void fetchPopular(initialCursor ?? "", "", true);
    } else {
      void fetchPopular("", nextLanguage, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCursor]);

  const handleSortChange = useCallback((nextSort: "popular" | "low_to_high_exact") => {
    setSort(nextSort);
    inFlightRef.current = false;
    setStreams([]);
    setCursor(null);
    setNextExactOffset(null);

    if (nextSort === "popular") {
      void fetchPopular("", language, true);
    } else {
      void fetchExact(0, language, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Infinite scroll: load more pages when the sentinel comes into view.
  useEffect(() => {
    if (loading) return;

    const canLoadMore = sort === "popular" ? cursor : nextExactOffset;
    if (!canLoadMore) return;

    const node = loadMoreRef.current;
    if (!node) return;

    const handler = () => {
      if (sort === "popular") {
        void fetchPopular(cursor!, language, false);
      } else {
        void fetchExact(nextExactOffset!, language, false);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) handler();
      },
      { rootMargin: "900px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, nextExactOffset, loading, sort, language, fetchPopular, fetchExact]);

  const canExact = language !== "";

  return (
    <section className="stack-lg">
      <div className="panel">
        <p className="eyebrow">Browse</p>
        <h1>All streams</h1>
        {availableLanguages.length > 0 ? (
          <div className="hero-controls" style={{ justifyContent: "flex-end" }}>
            <select
              value={language}
              autoComplete="off"
              onChange={(event) => handleLanguageChange(event.target.value)}
              className="text-input compact-input select-input"
              aria-label="Filter streams by language"
            >
              <option value="">All languages</option>
              {availableLanguages.map((code) => (
                <option key={code} value={code}>
                  {formatLanguageLabel(code)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {canExact ? (
          <div className="hero-controls">
            <div className="segmented">
              <button
                type="button"
                className={sort === "popular" ? "segment active" : "segment"}
                onClick={() => handleSortChange("popular")}
              >
                Popular
              </button>
              <button
                type="button"
                className={sort === "low_to_high_exact" ? "segment active" : "segment"}
                onClick={() => handleSortChange("low_to_high_exact")}
              >
                Exact low to high
              </button>
            </div>
          </div>
        ) : null}
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

      {(sort === "popular" ? cursor : nextExactOffset) ? (
        <div ref={loadMoreRef} className="stream-load-sentinel">
          {loading ? "Loading more streams" : "Scroll to load more"}
        </div>
      ) : streams.length > 36 ? (
        <div className="stream-load-sentinel">All loaded</div>
      ) : null}
    </section>
  );
}
