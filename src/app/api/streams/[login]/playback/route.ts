import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { isValidTwitchLogin, resolveStreamPlaybackUrl } from "@/lib/streamlink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ login: string }> }) {
  const { login } = await context.params;

  if (!isValidTwitchLogin(login)) {
    return jsonError("Invalid channel name.", 400);
  }

  const quality = request.nextUrl.searchParams.get("quality");
  const result = await resolveStreamPlaybackUrl(login, quality, request.signal);

  if (!result.ok) {
    const status = result.reason === "offline" ? 409 : result.reason === "not_found" ? 404 : 502;
    return jsonError(result.message, status);
  }

  return NextResponse.json({ url: result.url, login });
}
