import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { findActiveRefreshJob } from "@/lib/local-store";
import { getCategoryFiltersHash, getLatestSnapshot, getSnapshotById } from "@/lib/refresh";
import { serializeSnapshotStream, serializeTwitchStream } from "@/lib/serializers";
import { getStreamsByCategory } from "@/lib/twitch";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;
  const sort = request.nextUrl.searchParams.get("sort") ?? "popular";
  const language = request.nextUrl.searchParams.get("language") ?? undefined;
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const snapshotId = request.nextUrl.searchParams.get("snapshotId") ?? undefined;

  try {
    if (sort === "popular") {
      const response = await getStreamsByCategory({
        categoryId,
        language,
        cursor
      });

      return NextResponse.json({
        sort,
        data: response.data.map(serializeTwitchStream),
        cursor: response.pagination?.cursor ?? null
      });
    }

    if (sort !== "low_to_high_exact") {
      return jsonError("Unsupported sort mode.", 400);
    }

    const snapshot = snapshotId
      ? await getSnapshotById(snapshotId)
      : await getLatestSnapshot({ categoryId, language });

    const activeJob = findActiveRefreshJob(
      getCategoryFiltersHash({
        categoryId,
        categoryName: snapshot?.categoryName ?? "",
        language
      })
    );

    return NextResponse.json({
      sort,
      data: snapshot?.streams.map(serializeSnapshotStream) ?? [],
      snapshot: snapshot
        ? {
            id: snapshot.id,
            categoryId: snapshot.categoryId,
            categoryName: snapshot.categoryName,
            language: snapshot.language,
            completedAt: snapshot.completedAt,
            streamCount: snapshot.streamCount,
            duplicateCount: snapshot.duplicateCount
          }
        : null,
      activeJob: activeJob
        ? {
            id: activeJob.id,
            status: activeJob.status,
            pageCount: activeJob.pageCount,
            streamCount: activeJob.streamCount,
            duplicateCount: activeJob.duplicateCount,
            error: activeJob.error,
            snapshotId: activeJob.snapshotId,
            completedAt: activeJob.completedAt
          }
        : null
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load category streams.", 500);
  }
}
