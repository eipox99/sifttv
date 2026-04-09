"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { StreamCard } from "@/components/stream-card";

type CategoryResult = {
  id: string;
  name: string;
  boxArtUrl: string;
};

type ChannelResult = {
  id: string;
  login: string;
  displayName: string;
  title: string;
  categoryId: string;
  categoryName: string;
  thumbnailUrl: string;
  isLive: boolean;
  startedAtLabel: string | null;
  url: string;
};

export function SearchExplorer() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [categories, setCategories] = useState<CategoryResult[]>([]);
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (deferredQuery.length < 2) {
      setCategories([]);
      setChannels([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/search/categories?q=${encodeURIComponent(deferredQuery)}`, { cache: "no-store" }),
      fetch(`/api/search/channels?q=${encodeURIComponent(deferredQuery)}`, { cache: "no-store" })
    ])
      .then(async ([categoriesResponse, channelsResponse]) => {
        const [categoriesPayload, channelsPayload] = await Promise.all([
          categoriesResponse.json(),
          channelsResponse.json()
        ]);

        if (!active) {
          return;
        }

        if (!categoriesResponse.ok) {
          throw new Error(categoriesPayload.error ?? "Category search failed.");
        }

        if (!channelsResponse.ok) {
          throw new Error(channelsPayload.error ?? "Channel search failed.");
        }

        setCategories(categoriesPayload.data ?? []);
        setChannels(channelsPayload.data ?? []);
      })
      .catch((fetchError) => {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Search failed.");
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
  }, [deferredQuery]);

  return (
    <section className="stack-lg">
      <div className="panel search-panel">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find categories and live channels</h1>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Just Chatting, chess, asmongold..."
          className="text-input"
        />
        <p className="muted">Search starts after two characters and hits both live channels and category names.</p>
      </div>

      {loading ? <div className="pill">Searching</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      <div className="two-column">
        <section className="panel">
          <div className="section-head">
            <h2>Categories</h2>
            <span className="pill">{categories.length}</span>
          </div>
          <div className="category-list">
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.id}`} className="search-category-row">
                <img src={category.boxArtUrl} alt={category.name} className="search-category-thumb" />
                <div>
                  <strong>{category.name}</strong>
                  <div className="muted">Open category directory</div>
                </div>
              </Link>
            ))}
            {!loading && deferredQuery.length >= 2 && categories.length === 0 ? (
              <div className="muted">No category matches.</div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <h2>Live channels</h2>
            <span className="pill">{channels.length}</span>
          </div>
          <div className="stream-grid">
            {channels.map((channel) => (
              <StreamCard
                key={channel.id}
                id={channel.id}
                channelId={channel.id}
                login={channel.login}
                displayName={channel.displayName}
                title={channel.title}
                viewerCount={null}
                startedAtLabel={channel.startedAtLabel ?? "Live"}
                language={null}
                thumbnailUrl={channel.thumbnailUrl}
                categoryId={channel.categoryId}
                categoryName={channel.categoryName}
                url={channel.url}
              />
            ))}
            {!loading && deferredQuery.length >= 2 && channels.length === 0 ? (
              <div className="muted">No live channel matches.</div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
