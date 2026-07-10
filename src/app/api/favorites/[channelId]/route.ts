import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { deleteFavorite, migrateFavoritesUserId } from "@/lib/local-store";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError("You need to sign in to use favorites.", 401);
  }

  if (session.user.legacyId) {
    migrateFavoritesUserId(session.user.legacyId, session.user.id);
  }

  const { channelId } = await context.params;

  deleteFavorite(session.user.id, channelId);

  return NextResponse.json({ ok: true });
}
