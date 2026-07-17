import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { deleteFavoriteCategory, migrateFavoriteCategoriesUserId } from "@/lib/local-store";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("You need to sign in to use category favorites.", 401);
  }

  if (session.user.legacyId) {
    migrateFavoriteCategoriesUserId(session.user.legacyId, session.user.id);
  }

  const { categoryId } = await context.params;

  deleteFavoriteCategory(session.user.id, categoryId);

  return NextResponse.json({ ok: true });
}
