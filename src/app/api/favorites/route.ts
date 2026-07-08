import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { hasTwitchClientCredentials } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { listFavorites, upsertFavorite } from "@/lib/local-store";
import { serializeFavorite } from "@/lib/serializers";
import { getStreamsByUserIds } from "@/lib/twitch";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonError("You need to sign in to use favorites.", 401);
    }

    const favorites = listFavorites(session.user.id);
    const data = favorites.map((favorite) => ({
      ...serializeFavorite(favorite),
      isLive: false as boolean,
      viewerCount: null as number | null,
      title: null as string | null
    }));

    if (hasTwitchClientCredentials() && data.length > 0) {
      try {
        const streams = await getStreamsByUserIds(data.map((favorite) => favorite.channelId));
        const liveByUserId = new Map(streams.map((stream) => [stream.user_id, stream]));

        for (const favorite of data) {
          const live = liveByUserId.get(favorite.channelId);
          if (!live) {
            continue;
          }

          favorite.isLive = true;
          favorite.viewerCount = live.viewer_count;
          favorite.title = live.title;
          favorite.startedAt = live.started_at;
          favorite.categoryId = live.game_id || favorite.categoryId;
          favorite.categoryName = live.game_name || favorite.categoryName;
        }
      } catch {
        // Live augmentation is best-effort; fall back to saved data.
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load favorites.", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("You need to sign in to use favorites.", 401);
  }

  try {
    const body = (await request.json()) as {
      channelId?: string;
      broadcasterLogin?: string;
      broadcasterName?: string;
      thumbnailUrl?: string | null;
      categoryId?: string | null;
      categoryName?: string | null;
    };

    if (!body.channelId || !body.broadcasterLogin || !body.broadcasterName) {
      return jsonError("Missing favorite fields.", 400);
    }

    const favorite = upsertFavorite(session.user.id, {
      channelId: body.channelId,
      broadcasterLogin: body.broadcasterLogin,
      broadcasterName: body.broadcasterName,
      thumbnailUrl: body.thumbnailUrl,
      categoryId: body.categoryId,
      categoryName: body.categoryName
    });

    return NextResponse.json({
      favorite: serializeFavorite(favorite)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save favorite.", 500);
  }
}
