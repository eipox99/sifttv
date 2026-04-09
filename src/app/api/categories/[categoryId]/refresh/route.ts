import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { createOrReuseRefreshJob } from "@/lib/refresh";
import { getGamesByIds } from "@/lib/twitch";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      categoryName?: string;
      language?: string | null;
    };

    let categoryName = body.categoryName;
    if (!categoryName) {
      const categoryResponse = await getGamesByIds([categoryId]);
      categoryName = categoryResponse.data[0]?.name;
    }

    if (!categoryName) {
      return jsonError("Category name could not be resolved.", 404);
    }

    const job = await createOrReuseRefreshJob({
      categoryId,
      categoryName,
      language: body.language ?? null
    });

    return NextResponse.json({
      job: {
        id: job.id,
        status: job.status,
        pageCount: job.pageCount,
        streamCount: job.streamCount,
        duplicateCount: job.duplicateCount,
        createdAt: job.createdAt
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to start refresh.", 500);
  }
}
