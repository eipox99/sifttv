import { NextResponse } from "next/server";

import { hasTwitchClientCredentials } from "@/lib/env";
import { buildTwitchThumbnail } from "@/lib/formatters";
import { jsonError } from "@/lib/http";
import { isValidTwitchLogin } from "@/lib/streamlink";
import { getStreamByUserLogin } from "@/lib/twitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ login: string }> }) {
  const { login } = await context.params;

  if (!isValidTwitchLogin(login)) {
    return jsonError("Invalid channel name.", 400);
  }

  if (!hasTwitchClientCredentials()) {
    return NextResponse.json({
      login,
      channelId: null,
      displayName: null,
      title: null,
      categoryName: null,
      categoryId: null,
      viewerCount: null,
      thumbnailUrl: null
    });
  }

  try {
    const stream = await getStreamByUserLogin(login);

    return NextResponse.json({
      login,
      channelId: stream?.user_id ?? null,
      displayName: stream?.user_name ?? null,
      title: stream?.title ?? null,
      categoryName: stream?.game_name ?? null,
      categoryId: stream?.game_id ?? null,
      viewerCount: typeof stream?.viewer_count === "number" ? stream.viewer_count : null,
      startedAt: stream?.started_at ?? null,
      thumbnailUrl: stream?.thumbnail_url ? buildTwitchThumbnail(stream.thumbnail_url) : null
    });
  } catch {
    return jsonError("Failed to load stream info.", 502);
  }
}
