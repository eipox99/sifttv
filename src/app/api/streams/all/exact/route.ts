import { NextRequest, NextResponse } from "next/server";

import { buildTwitchThumbnail, formatDateTime } from "@/lib/formatters";
import { jsonError } from "@/lib/http";
import { getAllStreams } from "@/lib/twitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60_000;
const CRAWL_PAGE_CAP = 30;

const streamCache = new Map<string, { data: StreamItem[]; cachedAt: number }>();

type StreamItem = {
  id: string;
  channelId: string;
  login: string;
  displayName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  language: string;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
};

function buildItem(stream: { id: string; user_id: string; user_login: string; user_name: string; title: string; viewer_count: number; started_at: string; language: string; thumbnail_url: string; game_id: string; game_name: string }) {
  return {
    id: stream.id,
    channelId: stream.user_id,
    login: stream.user_login,
    displayName: stream.user_name,
    title: stream.title,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    language: stream.language,
    thumbnailUrl: buildTwitchThumbnail(stream.thumbnail_url),
    startedAtLabel: formatDateTime(stream.started_at),
    categoryId: stream.game_id,
    categoryName: stream.game_name
  };
}

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get("language");
  if (!language) {
    return jsonError("A language code is required.", 400);
  }

  const offset = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "36", 10) || 36, 100);

  try {
    let cached = streamCache.get(language);
    if (!cached || Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      const allStreams: StreamItem[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < CRAWL_PAGE_CAP; page += 1) {
        const response = await getAllStreams({ language, cursor, limit: 100 });
        allStreams.push(...response.data.map(buildItem));
        cursor = response.pagination?.cursor;
        if (!cursor || response.data.length === 0) break;
      }

      allStreams.sort((a, b) => a.viewerCount - b.viewerCount);

      cached = { data: allStreams, cachedAt: Date.now() };
      streamCache.set(language, cached);
    }

    const page = cached.data.slice(offset, offset + limit);
    const nextOffset = offset + limit < cached.data.length ? offset + limit : null;

    return NextResponse.json({
      data: page,
      nextOffset,
      total: cached.data.length
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load exact streams.", 500);
  }
}
