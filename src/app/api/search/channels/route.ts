import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { serializeSearchChannel } from "@/lib/serializers";
import { searchChannels } from "@/lib/twitch";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ data: [], cursor: null });
  }

  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const response = await searchChannels(query, cursor, true);

    return NextResponse.json({
      data: response.data.map(serializeSearchChannel),
      cursor: response.pagination?.cursor ?? null
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to search live channels.", 500);
  }
}

