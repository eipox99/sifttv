import { FavoriteButton } from "@/components/favorite-button";
import { formatLanguageLabel, formatViewerCount } from "@/lib/formatters";

type StreamCardProps = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount?: number | null;
  startedAtLabel: string;
  language?: string | null;
  thumbnailUrl: string;
  categoryId?: string | null;
  categoryName?: string | null;
  url: string;
};

export function StreamCard(props: StreamCardProps) {
  return (
    <article className="stream-card">
      <a
        href={props.url}
        target="_blank"
        rel="noreferrer"
        className="stream-card-link"
        aria-label={`Open ${props.displayName} on Twitch`}
      />
      <div className="stream-thumb-frame">
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
          <span>{props.startedAtLabel}</span>
          {props.login ? <span>@{props.login}</span> : null}
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
  );
}
