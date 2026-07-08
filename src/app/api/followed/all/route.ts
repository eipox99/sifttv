import { NextRequest, NextResponse } from "next/server";

import { hasAuthRuntimeConfig } from "@/lib/env";
import { buildLivePreviewUrl } from "@/lib/formatters";
import { jsonError } from "@/lib/http";
import { serializeTwitchStream } from "@/lib/serializers";
import { resolveTwitchUserToken } from "@/lib/twitch-auth";
import { getAllFollowedChannels, getAllFollowedLiveStreams } from "@/lib/twitch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasAuthRuntimeConfig()) {
    return jsonError("Followed channels require Twitch sign-in to be configured.", 503);
  }

  const resolved = await resolveTwitchUserToken(request);
  if (!resolved) {
    return jsonError("You need to sign in with Twitch to load your followed channels.", 401);
  }

  try {
    const [channels, liveStreams] = await Promise.all([
      getAllFollowedChannels(resolved.userId, resolved.accessToken),
      getAllFollowedLiveStreams(resolved.userId, resolved.accessToken)
    ]);

    const liveByUserId = new Map(liveStreams.map((stream) => [stream.user_id, stream]));

    const data = channels.map((channel) => {
      const live = liveByUserId.get(channel.broadcaster_id);
      if (live) {
        return { ...serializeTwitchStream(live), isLive: true };
      }

      return {
        id: channel.broadcaster_id,
        channelId: channel.broadcaster_id,
        login: channel.broadcaster_login,
        displayName: channel.broadcaster_name,
        title: null,
        viewerCount: null,
        startedAt: null,
        startedAtLabel: null,
        language: null,
        thumbnailUrl: buildLivePreviewUrl(channel.broadcaster_login),
        categoryId: null,
        categoryName: null,
        tags: [] as string[],
        isMature: false,
        url: `https://www.twitch.tv/${channel.broadcaster_login}`,
        isLive: false
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load followed channels.", 500);
  }
}
