"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { StreamCard } from "@/components/stream-card";
import { formatDateTime, formatLanguageLabel, normalizeLanguageCode } from "@/lib/formatters";
import { CATEGORY_STREAM_BATCH_SIZE } from "@/lib/pagination";

const REFRESH_INTERVAL_MS = 300_000;

type StreamItem = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  startedAt: string | null;
  startedAtLabel: string;
  language: string;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
  url: string;
};

type SnapshotInfo = {
  id: string;
  categoryId: string;
  categoryName: string;
  language: string | null;
  completedAt: string;
  streamCount: number;
  duplicateCount: number;
};

type ActiveJob = {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  pageCount: number;
  streamCount: number;
  duplicateCount: number;
  error: string | null;
  snapshotId: string | null;
  completedAt: string | null;
};

type CategoryExplorerProps = {
  categoryId: string;
  categoryName: string;
  initialPopular: StreamItem[];
  initialCursor: string | null;
  initialSort: "popular" | "low_to_high_exact";
  initialLanguage: string;
  initialAvailableLanguages: string[];
  initialExcludeFollowerOnly: boolean;
  exactReady: boolean;
};

function collectLanguages(streams: StreamItem[]) {
  return Array.from(
    new Set(
      streams
        .map((stream) => normalizeLanguageCode(stream.language))
        .filter((language): language is string => Boolean(language))
    )
  );
}

function compareLanguages(left: string, right: string) {
  return formatLanguageLabel(left).localeCompare(formatLanguageLabel(right));
}

export function CategoryExplorer({
  categoryId,
  categoryName,
  initialPopular,
  initialCursor,
  initialSort,
  initialLanguage,
  initialAvailableLanguages,
  initialExcludeFollowerOnly,
  exactReady
}: CategoryExplorerProps) {
  const [sort, setSort] = useState<"popular" | "low_to_high_exact">(initialSort);
  const [language, setLanguage] = useState(initialLanguage);
  const [excludeFollowerOnly, setExcludeFollowerOnly] = useState(initialExcludeFollowerOnly);
  const [discoveredLanguages, setDiscoveredLanguages] = useState<string[]>(() => {
    const merged = new Set([...initialAvailableLanguages, ...collectLanguages(initialPopular)]);
    return [...merged].sort(compareLanguages);
  });
  const [popularStreams, setPopularStreams] = useState(initialPopular);
  const [popularCursor, setPopularCursor] = useState(initialCursor);
  const [snapshotStreams, setSnapshotStreams] = useState<StreamItem[]>([]);
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [nextExactOffset, setNextExactOffset] = useState<number | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingExact, setLoadingExact] = useState(false);
  const [loadingMorePopular, setLoadingMorePopular] = useState(false);
  const [loadingMoreExact, setLoadingMoreExact] = useState(false);
  const [pendingRefresh, startRefreshTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const skipInitialPopularFetchRef = useRef(true);
  const popularLoadInFlightRef = useRef(false);
  const exactLoadInFlightRef = useRef(false);
  const exactAbortRef = useRef<AbortController | null>(null);
  const snapshotStreamsRef = useRef<StreamItem[]>(snapshotStreams);
  snapshotStreamsRef.current = snapshotStreams;
  const autoRefreshTimeRef = useRef(0);
  const loadExactRef = useRef(loadExact);
  loadExactRef.current = loadExact;
  const loadExactDeltaRef = useRef(loadExactDelta);
  loadExactDeltaRef.current = loadExactDelta;
  const activeStreams = useMemo(
    () => (sort === "popular" ? popularStreams : snapshotStreams),
    [popularStreams, snapshotStreams, sort]
  );
  const hasMoreStreams = sort === "popular" ? Boolean(popularCursor) : nextExactOffset !== null;
  const loadingMoreStreams = sort === "popular" ? loadingMorePopular : loadingMoreExact;
  const availableLanguages = useMemo(() => {
    const nextLanguages = new Set(discoveredLanguages);
    const currentLanguage = normalizeLanguageCode(language);
    if (currentLanguage) {
      nextLanguages.add(currentLanguage);
    }

    return [...nextLanguages].sort(compareLanguages);
  }, [discoveredLanguages, language]);

  function mergeDiscoveredLanguages(streams: StreamItem[]) {
    const nextLanguages = collectLanguages(streams);
    if (nextLanguages.length === 0) {
      return;
    }

    setDiscoveredLanguages((currentLanguages) => {
      const merged = new Set(currentLanguages);
      for (const nextLanguage of nextLanguages) {
        merged.add(nextLanguage);
      }

      return [...merged].sort(compareLanguages);
    });
  }

  async function persistPreferences(input: {
    categorySort?: "popular" | "low_to_high_exact";
    categoryLanguage?: string;
    excludeFollowerOnly?: boolean;
  }) {
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        categorySort: input.categorySort,
        categoryLanguage: input.categoryLanguage ?? null,
        excludeFollowerOnly: input.excludeFollowerOnly
      })
    });
  }

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (!activeJob || !["QUEUED", "RUNNING"].includes(activeJob.status)) {
      return;
    }

    const poll = async () => {
      const response = await fetch(`/api/refresh/${activeJob.id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to poll refresh job.");
        return;
      }

      setActiveJob(payload.job);
      if (payload.job.status === "COMPLETED") {
        await loadExactDeltaRef.current(payload.job.snapshotId!);
      }

      if (payload.job.status === "FAILED") {
        setError(payload.job.error ?? "Refresh job failed.");
      }
    };

    intervalId = setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeJob]);

  // Auto-refresh snapshot when it goes stale
  useEffect(() => {
    if (sort !== "low_to_high_exact" || !snapshot || !exactReady) {
      return;
    }

    if (activeJob && ["QUEUED", "RUNNING"].includes(activeJob.status)) {
      return;
    }

    const now = Date.now();
    const completedAt = new Date(snapshot.completedAt).getTime();
    const staleThreshold = now - REFRESH_INTERVAL_MS;

    if (completedAt < staleThreshold && autoRefreshTimeRef.current < staleThreshold) {
      autoRefreshTimeRef.current = now;
      setError(null);
      fetch(`/api/categories/${categoryId}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryName, language: language || null })
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) {
            setError(payload.error ?? "Failed to start refresh.");
            return;
          }
          setActiveJob(payload.job);
        })
        .catch((fetchError) => {
          setError(fetchError instanceof Error ? fetchError.message : "Auto-refresh failed.");
        });
    }
  }, [sort, snapshot, exactReady, activeJob, categoryId, categoryName, language]);

  useEffect(() => {
    if (sort !== "low_to_high_exact") {
      return;
    }

    void loadExact({ reset: true });
  }, [sort, language, excludeFollowerOnly]);

  useEffect(() => {
    if (sort !== "popular") {
      return;
    }

    if (skipInitialPopularFetchRef.current) {
      skipInitialPopularFetchRef.current = false;
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const params = new URLSearchParams({
      sort: "popular",
      limit: String(CATEGORY_STREAM_BATCH_SIZE),
      excludeFollowerOnly: excludeFollowerOnly ? "true" : "false"
    });
    if (language) {
      params.set("language", language);
    }

    setError(null);
    setLoadingMorePopular(false);

    fetch(`/api/categories/${categoryId}/streams?${params.toString()}`, {
      cache: "no-store",
      signal
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load category streams.");
        }

        if (signal.aborted) {
          return;
        }

        const nextStreams = payload.data ?? [];
        setPopularStreams(nextStreams);
        setPopularCursor(payload.cursor);
        mergeDiscoveredLanguages(nextStreams);
      })
      .catch((fetchError) => {
        if (!signal.aborted && (fetchError as Error).name !== "AbortError") {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load category streams.");
        }
      });

    return () => {
      controller.abort();
    };
  }, [categoryId, excludeFollowerOnly, language, sort]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMoreStreams || loadingMoreStreams || loadingExact) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        if (sort === "popular") {
          void loadMorePopular();
          return;
        }

        void loadMoreExact();
      },
      {
        rootMargin: "900px 0px"
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [
    hasMoreStreams,
    loadingExact,
    loadingMoreStreams,
    sort,
    popularCursor,
    nextExactOffset,
    language,
    excludeFollowerOnly
  ]);

  async function loadExact(options?: {
    snapshotId?: string;
    offset?: number;
    append?: boolean;
    reset?: boolean;
  }) {
    const append = options?.append ?? false;
    if (append) {
      if (exactLoadInFlightRef.current || nextExactOffset === null) {
        return;
      }
      exactLoadInFlightRef.current = true;
      setLoadingMoreExact(true);
    } else {
      setLoadingExact(true);
      setSnapshotStreams([]);
      setSnapshot(null);
      setActiveJob(null);
      setNextExactOffset(null);
    }

    exactAbortRef.current?.abort();
    const controller = new AbortController();
    exactAbortRef.current = controller;
    const { signal } = controller;

    setError(null);

    try {
      const params = new URLSearchParams({
        sort: "low_to_high_exact",
        limit: String(CATEGORY_STREAM_BATCH_SIZE),
        excludeFollowerOnly: excludeFollowerOnly ? "true" : "false"
      });
      if (language) {
        params.set("language", language);
      }
      if (options?.snapshotId) {
        params.set("snapshotId", options.snapshotId);
      }
      if (append) {
        params.set("offset", String(options?.offset ?? nextExactOffset ?? 0));
      }

      const response = await fetch(`/api/categories/${categoryId}/streams?${params.toString()}`, {
        cache: "no-store",
        signal
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load exact snapshot.");
      }

      if (signal.aborted) {
        return;
      }

      const nextSnapshotStreams = payload.data ?? [];
      setSnapshotStreams((current) => (append ? [...current, ...nextSnapshotStreams] : nextSnapshotStreams));
      setSnapshot(payload.snapshot);
      setActiveJob(payload.activeJob);
      setNextExactOffset(payload.nextOffset ?? null);
      mergeDiscoveredLanguages(nextSnapshotStreams);
    } catch (fetchError) {
      if (!signal.aborted && (fetchError as Error).name !== "AbortError") {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load exact snapshot.");
      }
    } finally {
      if (exactAbortRef.current === controller) {
        exactAbortRef.current = null;
      }

      if (append) {
        exactLoadInFlightRef.current = false;
        setLoadingMoreExact(false);
      } else if (!signal.aborted) {
        setLoadingExact(false);
      }
    }
  }

  async function loadExactDelta(snapshotId: string) {
    setLoadingExact(true);
    const knownIds = snapshotStreamsRef.current.map((s) => s.id);
    const params = new URLSearchParams({ snapshotId });
    if (knownIds.length > 0) {
      params.set("knownIds", knownIds.join(","));
    }

    try {
      const response = await fetch(
        `/api/categories/${categoryId}/streams/delta?${params.toString()}`,
        { cache: "no-store" }
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Failed to load snapshot delta.");
        return;
      }

      setSnapshotStreams((current) => {
        const newIds = new Set(payload.newStreams.map((s: StreamItem) => s.id));
        const keep = current.filter((s) => !payload.removedIds.includes(s.id) && !newIds.has(s.id));
        const merged = [...keep, ...payload.newStreams];
        merged.sort((a: StreamItem, b: StreamItem) => a.viewerCount - b.viewerCount);
        return merged;
      });

      setSnapshot(payload.snapshot);
      setActiveJob(payload.activeJob);
    } catch (fetchError) {
      if ((fetchError as Error).name !== "AbortError") {
        setError(fetchError instanceof Error ? fetchError.message : "Delta fetch failed.");
      }
    } finally {
      setLoadingExact(false);
    }
  }

  async function loadMorePopular() {
    if (!popularCursor || popularLoadInFlightRef.current) {
      return;
    }

    popularLoadInFlightRef.current = true;
    setLoadingMorePopular(true);

    const params = new URLSearchParams({
      sort: "popular",
      cursor: popularCursor,
      limit: String(CATEGORY_STREAM_BATCH_SIZE),
      excludeFollowerOnly: excludeFollowerOnly ? "true" : "false"
    });
    if (language) {
      params.set("language", language);
    }

    try {
      const response = await fetch(`/api/categories/${categoryId}/streams?${params.toString()}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Failed to load more streams.");
        return;
      }

      const nextStreams = payload.data ?? [];
      setPopularStreams((current) => [...current, ...nextStreams]);
      setPopularCursor(payload.cursor);
      mergeDiscoveredLanguages(nextStreams);
    } finally {
      popularLoadInFlightRef.current = false;
      setLoadingMorePopular(false);
    }
  }

  async function loadMoreExact() {
    if (nextExactOffset === null) {
      return;
    }

    await loadExact({
      snapshotId: snapshot?.id ?? undefined,
      offset: nextExactOffset,
      append: true
    });
  }

  return (
    <section className="stack-lg">
      <div className="hero panel">
        <div>
          <p className="eyebrow">Category</p>
          <h1>{categoryName}</h1>
          <p className="muted">
            Popular mode reads Twitch directly. Exact low-to-high builds a deduplicated category snapshot and keeps
            the previous snapshot visible during refresh.
          </p>
        </div>
        <div className="hero-controls">
          <div className="segmented">
            <button
              className={sort === "popular" ? "segment active" : "segment"}
              onClick={() => {
                setSort("popular");
                void persistPreferences({
                  categorySort: "popular"
                });
              }}
            >
              Popular
            </button>
            <button
              className={sort === "low_to_high_exact" ? "segment active" : "segment"}
              disabled={!exactReady}
              onClick={() => {
                setSort("low_to_high_exact");
                void persistPreferences({
                  categorySort: "low_to_high_exact"
                });
              }}
            >
              Exact low to high
            </button>
          </div>
          <select
            value={language}
            onChange={(event) => {
              const nextLanguage = normalizeLanguageCode(event.target.value) ?? "";
              setLanguage(nextLanguage);
              void persistPreferences({
                categoryLanguage: nextLanguage
              });
            }}
            className="text-input compact-input select-input"
            aria-label="Filter streams by language"
          >
            <option value="">All languages</option>
            {availableLanguages.map((languageOption) => (
              <option key={languageOption} value={languageOption}>
                {formatLanguageLabel(languageOption)}
              </option>
            ))}
          </select>
          <button
            className={excludeFollowerOnly ? "segment active" : "segment"}
            onClick={() => {
              const nextExcludeFollowerOnly = !excludeFollowerOnly;
              setExcludeFollowerOnly(nextExcludeFollowerOnly);
              void persistPreferences({
                excludeFollowerOnly: nextExcludeFollowerOnly
              });
            }}
            type="button"
          >
            Exclude follower-only chat
          </button>
          <button
            className="button button-primary"
            disabled={pendingRefresh || !exactReady}
            onClick={() =>
              startRefreshTransition(async () => {
                if (!exactReady) {
                  return;
                }
                setError(null);
                const response = await fetch(`/api/categories/${categoryId}/refresh`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    categoryName,
                    language: language || null
                  })
                });
                const payload = await response.json();

                if (!response.ok) {
                  setError(payload.error ?? "Failed to start refresh.");
                  return;
                }

                setActiveJob(payload.job);
                await loadExact({ reset: true });
              })
            }
          >
            {pendingRefresh ? "Starting refresh" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      {sort === "low_to_high_exact" ? (
        <div className="panel status-grid">
          <div>
            <div className="eyebrow">Snapshot</div>
            <strong>{snapshot ? `${snapshot.streamCount} streams` : "No snapshot yet"}</strong>
            <div className="muted">
              {snapshot
                ? activeJob && ["QUEUED", "RUNNING"].includes(activeJob.status)
                  ? `Refreshing…`
                  : `Completed ${formatDateTime(snapshot.completedAt)} with ${snapshot.duplicateCount} duplicates removed`
                : "Run a refresh to build the first ascending snapshot."}
            </div>
          </div>
          <div>
            <div className="eyebrow">Refresh status</div>
            <strong>{activeJob ? activeJob.status : "Idle"}</strong>
            <div className="muted">
              {activeJob
                ? `${activeJob.pageCount} pages, ${activeJob.streamCount} streams, ${activeJob.duplicateCount} duplicates`
                : "No refresh running."}
            </div>
          </div>
        </div>
      ) : null}

      {loadingExact ? <div className="pill">Loading exact snapshot</div> : null}

      <div className="stream-grid">
        {activeStreams.map((stream) => (
          <StreamCard key={`${sort}-${stream.id}`} {...stream} />
        ))}
      </div>

      {activeStreams.length > 0 ? (
        <div ref={loadMoreRef} className="stream-load-sentinel">
          {loadingMoreStreams
            ? "Loading more streams"
            : hasMoreStreams
              ? "Scroll to load more"
              : "All loaded"}
        </div>
      ) : null}

      {activeStreams.length === 0 ? (
        <div className="panel muted">
          {sort === "popular"
            ? "No live streams matched this filter."
            : "No exact snapshot is available yet for this filter."}
        </div>
      ) : null}
    </section>
  );
}
