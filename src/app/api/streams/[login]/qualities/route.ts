import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getStreamQualities, isValidTwitchLogin } from "@/lib/streamlink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ login: string }> }) {
  const { login } = await context.params;

  if (!isValidTwitchLogin(login)) {
    return jsonError("Invalid channel name.", 400);
  }

  try {
    const qualities = await getStreamQualities(login, request.signal);
    return NextResponse.json({ qualities });
  } catch {
    return jsonError("Failed to load stream qualities.", 502);
  }
}
