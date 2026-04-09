import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { listFavorites, upsertFavorite } from "@/lib/local-store";
import { serializeFavorite } from "@/lib/serializers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("You need to sign in to use favorites.", 401);
  }

  const favorites = listFavorites(session.user.id);

  return NextResponse.json({
    data: favorites.map(serializeFavorite)
  });
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
