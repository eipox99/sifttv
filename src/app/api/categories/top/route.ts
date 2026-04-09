import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { serializeCategory } from "@/lib/serializers";
import { getTopCategories } from "@/lib/twitch";

export async function GET(request: NextRequest) {
  try {
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const response = await getTopCategories(cursor);

    return NextResponse.json({
      data: response.data.map(serializeCategory),
      cursor: response.pagination?.cursor ?? null
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load top categories.", 500);
  }
}

