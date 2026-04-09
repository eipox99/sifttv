import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { auth } from "@/lib/auth";
import { env, hasAuthRuntimeConfig } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { serializeTwitchStream } from "@/lib/serializers";
import { getFollowedLiveStreams } from "@/lib/twitch";

export async function GET(request: NextRequest) {
  if (!hasAuthRuntimeConfig()) {
    return jsonError("Followed live requires Twitch sign-in to be configured.", 503);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("You need to sign in with Twitch to load followed live streams.", 401);
  }

  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const token = await getToken({
      req: request,
      secret: env.AUTH_SECRET
    });

    if (!token?.twitchAccessToken || !token?.twitchUserId) {
      return jsonError("You need to sign in with Twitch again.", 401);
    }

    const response = await getFollowedLiveStreams(token.twitchUserId, token.twitchAccessToken, cursor);

    return NextResponse.json({
      data: response.data.map(serializeTwitchStream),
      cursor: response.pagination?.cursor ?? null
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load followed live streams.", 500);
  }
}
