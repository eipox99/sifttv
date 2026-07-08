import { NextRequest, NextResponse } from "next/server";

import { buildTwitchThumbnail, formatDateTime } from "@/lib/formatters";
import { jsonError } from "@/lib/http";
import { getAllStreams } from "@/lib/twitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get("language") ?? undefined;
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "36", 10) || 36, 100);

  try {
    const response = await getAllStreams({ language, cursor, limit });

    const data = response.data.map((stream) => ({
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
      categoryName: stream.game_name
    }));

    return NextResponse.json({
      data,
      cursor: response.pagination?.cursor ?? null
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load streams.", 500);
  }
}
