import { useState, useRef, useCallback } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { usePreferences } from "@/components/preferences-store";
import { WatchOverlay } from "@/components/stream-player";
import { buildLivePreviewUrl, formatLanguageLabel, formatViewerCount } from "@/lib/formatters";

function formatDuration(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < 0) return "0m";
  const totalMinutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type StreamCardProps = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount?: number | null;
  startedAt?: string | null;
  startedAtLabel: string;
  language?: string | null;
  thumbnailUrl: string;
  categoryId?: string | null;
  categoryName?: string | null;
  url: string;
};

export function StreamCard(props: StreamCardProps) {
  const [hovered, setHovered] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const [below, setBelow] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { hoverPreview } = usePreferences();
  const previewUrl = buildLivePreviewUrl(props.login, 1280, 720);

  const showPreview = useCallback(() => {
    if (!hoverPreview) return;
    setHovered(true);
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const popoverWidth = Math.min(630, vw * 0.85);
    const popoverHeight = popoverWidth * 9 / 16;

    // vertical — flip below if not enough room above
    setBelow(rect.top < popoverHeight + 24);

    // horizontal — nudge to keep inside viewport
    const center = rect.left + rect.width / 2;
    const leftEdge = center - popoverWidth / 2;
    const rightEdge = center + popoverWidth / 2;
    let shift = 0;
    if (rightEdge > vw) shift = vw - rightEdge;
    else if (leftEdge < 0) shift = -leftEdge;
    setShiftX(shift);
  }, [hoverPreview]);

  const hidePreview = useCallback(() => {
    setHovered(false);
    setShiftX(0);
    setBelow(false);
  }, []);

  return (
    <div className="stream-card-wrap" ref={wrapRef}>
      <article className="stream-card">
        <WatchOverlay
          login={props.login}
          displayName={props.displayName}
          channelId={props.channelId}
          title={props.title}
          categoryName={props.categoryName}
          categoryId={props.categoryId}
          thumbnailUrl={props.thumbnailUrl}
          url={props.url}
        />
        <div className="stream-thumb-frame" onMouseEnter={showPreview} onMouseLeave={hidePreview}>
          <img src={props.thumbnailUrl} alt={props.title} className="stream-thumb" />
          {typeof props.viewerCount === "number" ? (
            <span className="viewer-chip stream-thumb-chip">{formatViewerCount(props.viewerCount)} viewers</span>
          ) : null}
        </div>
        <div className="stream-content">
          <div className="stream-topline">
            <span className="eyebrow">{props.categoryName ?? "Live"}</span>
            {props.language ? <span className="pill stream-language">{formatLanguageLabel(props.language)}</span> : null}
          </div>
          <div className="stream-head">
            <h3>{props.title}</h3>
            <p className="stream-channel">{props.displayName}</p>
          </div>
          <div className="stream-meta">
            <span>{props.startedAt ? formatDuration(props.startedAt) : props.startedAtLabel}</span>
          </div>
          <div className="stream-actions">
            <FavoriteButton
              channelId={props.channelId}
              broadcasterLogin={props.login}
              broadcasterName={props.displayName}
              thumbnailUrl={props.thumbnailUrl}
              categoryId={props.categoryId}
              categoryName={props.categoryName}
              compact
            />
          </div>
        </div>
      </article>
      {hoverPreview && hovered && typeof props.viewerCount === "number" ? (
        <div className={"stream-preview-popover" + (below ? " stream-preview-below" : "")} style={{ translate: `calc(-50% + ${shiftX}px) 0` }}>
          <img src={previewUrl} alt="" className="stream-preview-img" />
        </div>
      ) : null}
    </div>
  );
}
