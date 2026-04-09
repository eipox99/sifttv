import { buildTwitchThumbnail, formatDateTime } from "@/lib/formatters";
import type { FavoriteRecord, SnapshotStreamRecord } from "@/lib/local-store";
import { TwitchCategory, TwitchSearchChannel, TwitchStream } from "@/lib/twitch";

export function serializeCategory(category: TwitchCategory) {
  return {
    id: category.id,
    name: category.name,
    boxArtUrl: category.box_art_url.replace("{width}", "320").replace("{height}", "430")
  };
}

export function serializeTwitchStream(stream: TwitchStream) {
  return {
    id: stream.id,
    channelId: stream.user_id,
    login: stream.user_login,
    displayName: stream.user_name,
    title: stream.title,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    startedAtLabel: formatDateTime(stream.started_at),
    language: stream.language,
    thumbnailUrl: buildTwitchThumbnail(stream.thumbnail_url),
    categoryId: stream.game_id,
    categoryName: stream.game_name,
    tags: stream.tags ?? [],
    isMature: stream.is_mature,
    url: `https://www.twitch.tv/${stream.user_login}`
  };
}

export function serializeSnapshotStream(stream: SnapshotStreamRecord) {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(stream.tagsJson);
    tags = Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    tags = [];
  }

  return {
    id: stream.streamId,
    channelId: stream.userId,
    login: stream.userLogin,
    displayName: stream.userName,
    title: stream.title,
    viewerCount: stream.viewerCount,
    startedAt: stream.startedAt,
    startedAtLabel: formatDateTime(stream.startedAt),
    language: stream.language,
    thumbnailUrl: stream.thumbnailUrl,
    categoryId: stream.categoryId,
    categoryName: stream.categoryName,
    tags,
    isMature: Boolean(stream.isMature),
    url: `https://www.twitch.tv/${stream.userLogin}`
  };
}

export function serializeSearchChannel(channel: TwitchSearchChannel) {
  return {
    id: channel.id,
    login: channel.broadcaster_login,
    displayName: channel.display_name,
    title: channel.title,
    categoryId: channel.game_id,
    categoryName: channel.game_name,
    thumbnailUrl: channel.thumbnail_url,
    isLive: channel.is_live,
    startedAt: channel.started_at,
    startedAtLabel: channel.started_at ? formatDateTime(channel.started_at) : null,
    tags: channel.tags,
    url: `https://www.twitch.tv/${channel.broadcaster_login}`
  };
}

export function serializeFavorite(favorite: FavoriteRecord) {
  return {
    id: favorite.id,
    channelId: favorite.channelId,
    broadcasterLogin: favorite.broadcasterLogin,
    broadcasterName: favorite.broadcasterName,
    thumbnailUrl: favorite.thumbnailUrl,
    categoryId: favorite.categoryId,
    categoryName: favorite.categoryName,
    createdAt: new Date(favorite.createdAt).toISOString(),
    url: `https://www.twitch.tv/${favorite.broadcasterLogin}`
  };
}
