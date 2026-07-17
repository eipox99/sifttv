import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import {
  listFavoriteCategories,
  migrateFavoriteCategoriesUserId,
  upsertFavoriteCategory
} from "@/lib/local-store";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonError("You need to sign in to use category favorites.", 401);
    }

    if (session.user.legacyId) {
      migrateFavoriteCategoriesUserId(session.user.legacyId, session.user.id);
    }

    const categories = listFavoriteCategories(session.user.id);

    return NextResponse.json({ data: categories });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load favorite categories.", 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("You need to sign in to use category favorites.", 401);
  }

  try {
    if (session.user.legacyId) {
      migrateFavoriteCategoriesUserId(session.user.legacyId, session.user.id);
    }

    const body = (await request.json()) as {
      categoryId?: string;
      categoryName?: string;
      boxArtUrl?: string | null;
    };

    if (!body.categoryId || !body.categoryName) {
      return jsonError("Missing category fields.", 400);
    }

    const category = upsertFavoriteCategory(session.user.id, {
      categoryId: body.categoryId,
      categoryName: body.categoryName,
      boxArtUrl: body.boxArtUrl
    });

    return NextResponse.json({ category });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save favorite category.", 500);
  }
}
