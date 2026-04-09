import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { findActiveRefreshJob } from "@/lib/local-store";
import { getCategoryFiltersHash, getLatestSnapshot, getSnapshotById } from "@/lib/refresh";
import { serializeSnapshotStream, serializeTwitchStream } from "@/lib/serializers";
import { getStreamsByCategory } from "@/lib/twitch";

function parsePositiveInteger(value: string | null, fallback: number, max?: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string | null, fallback = 0) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;
  const sort = request.nextUrl.searchParams.get("sort") ?? "popular";
  const language = request.nextUrl.searchParams.get("language") ?? undefined;
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const snapshotId = request.nextUrl.searchParams.get("snapshotId") ?? undefined;
  const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), 36, 100);
  const offset = parseNonNegativeInteger(request.nextUrl.searchParams.get("offset"));

  try {
    if (sort === "popular") {
      const response = await getStreamsByCategory({
        categoryId,
        language,
        cursor,
        limit
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
      ? await getSnapshotById(snapshotId, { offset, limit })
      : await getLatestSnapshot({ categoryId, language }, { offset, limit });

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
      nextOffset:
        snapshot && offset + snapshot.streams.length < snapshot.streamCount ? offset + snapshot.streams.length : null,
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
