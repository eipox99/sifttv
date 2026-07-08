import { NextRequest, NextResponse } from "next/server";

import { hasAuthRuntimeConfig } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { serializeTwitchStream } from "@/lib/serializers";
import { resolveTwitchUserToken } from "@/lib/twitch-auth";
import { getFollowedLiveStreams } from "@/lib/twitch";

export async function GET(request: NextRequest) {
  if (!hasAuthRuntimeConfig()) {
    return jsonError("Followed live requires Twitch sign-in to be configured.", 503);
  }

  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const resolved = await resolveTwitchUserToken(request);

    if (!resolved) {
      return jsonError("You need to sign in with Twitch again.", 401);
    }

    const response = await getFollowedLiveStreams(resolved.userId, resolved.accessToken, cursor);

    return NextResponse.json({
      data: response.data.map(serializeTwitchStream),
      cursor: response.pagination?.cursor ?? null
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load followed live streams.", 500);
  }
}
