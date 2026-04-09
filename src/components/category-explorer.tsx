"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { StreamCard } from "@/components/stream-card";
import { formatDateTime, formatLanguageLabel, normalizeLanguageCode } from "@/lib/formatters";
import { CATEGORY_STREAM_BATCH_SIZE } from "@/lib/pagination";

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
  exactReady
}: CategoryExplorerProps) {
  const [sort, setSort] = useState<"popular" | "low_to_high_exact">("popular");
  const [language, setLanguage] = useState("");
  const [discoveredLanguages, setDiscoveredLanguages] = useState<string[]>(() =>
    collectLanguages(initialPopular).sort(compareLanguages)
  );
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
  const skipInitialPopularFetchRef = useRef(false);
  const popularLoadInFlightRef = useRef(false);
  const exactLoadInFlightRef = useRef(false);
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
        await loadExact({ snapshotId: payload.job.snapshotId ?? undefined });
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

  useEffect(() => {
    if (sort !== "low_to_high_exact") {
      return;
    }

    void loadExact({ reset: true });
  }, [sort, language]);

  useEffect(() => {
    let active = true;

    if (sort !== "popular") {
      return;
    }

    if (!skipInitialPopularFetchRef.current && !language) {
      skipInitialPopularFetchRef.current = true;
      return;
    }

    const params = new URLSearchParams({
      sort: "popular",
      limit: String(CATEGORY_STREAM_BATCH_SIZE)
    });
    if (language) {
      params.set("language", language);
    }

    setError(null);
    setLoadingMorePopular(false);

    fetch(`/api/categories/${categoryId}/streams?${params.toString()}`, {
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load category streams.");
        }

        if (!active) {
          return;
        }

        const nextStreams = payload.data ?? [];
        setPopularStreams(nextStreams);
        setPopularCursor(payload.cursor);
        mergeDiscoveredLanguages(nextStreams);
      })
      .catch((fetchError) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load category streams.");
        }
      });

    return () => {
      active = false;
    };
  }, [categoryId, language, sort]);

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
  }, [hasMoreStreams, loadingExact, loadingMoreStreams, sort, popularCursor, nextExactOffset]);

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

    setError(null);

    try {
      const params = new URLSearchParams({
        sort: "low_to_high_exact",
        limit: String(CATEGORY_STREAM_BATCH_SIZE)
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
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load exact snapshot.");
      }

      const nextSnapshotStreams = payload.data ?? [];
      setSnapshotStreams((current) => (append ? [...current, ...nextSnapshotStreams] : nextSnapshotStreams));
      setSnapshot(payload.snapshot);
      setActiveJob(payload.activeJob);
      setNextExactOffset(payload.nextOffset ?? null);
      mergeDiscoveredLanguages(nextSnapshotStreams);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load exact snapshot.");
    } finally {
      if (append) {
        exactLoadInFlightRef.current = false;
        setLoadingMoreExact(false);
      } else {
        setLoadingExact(false);
      }
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
      limit: String(CATEGORY_STREAM_BATCH_SIZE)
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
              onClick={() => setSort("popular")}
            >
              Popular
            </button>
            <button
              className={sort === "low_to_high_exact" ? "segment active" : "segment"}
              disabled={!exactReady}
              onClick={() => setSort("low_to_high_exact")}
            >
              Exact low to high
            </button>
          </div>
          <select
            value={language}
            onChange={(event) => setLanguage(normalizeLanguageCode(event.target.value) ?? "")}
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

                setSort("low_to_high_exact");
                setActiveJob(payload.job);
                await loadExact({ reset: true });
              })
            }
          >
            {pendingRefresh ? "Starting refresh" : "Refresh exact snapshot"}
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
                ? `Completed ${formatDateTime(snapshot.completedAt)} with ${snapshot.duplicateCount} duplicates removed`
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
