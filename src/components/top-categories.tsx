"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CategoryCard } from "@/components/category-card";

type CategoryItem = {
  id: string;
  name: string;
  boxArtUrl: string;
};

type TopCategoriesProps = {
  initialCategories: CategoryItem[];
  initialCursor: string | null;
};

export function TopCategories({ initialCategories, initialCursor }: TopCategoriesProps) {
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !cursor) {
      return;
    }

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/top?cursor=${encodeURIComponent(cursor)}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load more categories.");
      }

      const next: CategoryItem[] = payload.data ?? [];
      setCategories((current) => {
        const seen = new Set(current.map((category) => category.id));
        const merged = [...current];
        for (const category of next) {
          if (!seen.has(category.id)) {
            merged.push(category);
          }
        }
        return merged;
      });
      setCursor(payload.cursor ?? null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load more categories.");
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !cursor || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "900px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loading, loadMore]);

  return (
    <section className="stack-lg">
      <div className="section-head">
        <h2>Top categories</h2>
        <span className="pill">{categories.length}</span>
      </div>
      <div className="category-grid">
        {categories.map((category) => (
          <CategoryCard key={category.id} {...category} />
        ))}
      </div>
      {error ? <div className="error-box">{error}</div> : null}
      {cursor ? (
        <div ref={loadMoreRef} className="stream-load-sentinel">
          {loading ? "Loading more categories" : "Scroll to load more"}
        </div>
      ) : (
        <div className="stream-load-sentinel">All loaded</div>
      )}
    </section>
  );
}
