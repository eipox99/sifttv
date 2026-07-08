import { NextRequest, NextResponse } from "next/server";

import { loadExactCategoryStreams, loadPopularCategoryStreams } from "@/lib/category-streams";
import { jsonError } from "@/lib/http";
import { findActiveRefreshJob } from "@/lib/local-store";
import { getCategoryFiltersHash } from "@/lib/refresh";

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

function parseBoolean(value: string | null) {
  return value === "true";
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
  const excludeFollowerOnly = parseBoolean(request.nextUrl.searchParams.get("excludeFollowerOnly"));
  const limit = parsePositiveInteger(request.nextUrl.searchParams.get("limit"), 36, 100);
  const offset = parseNonNegativeInteger(request.nextUrl.searchParams.get("offset"));

  try {
    if (sort === "popular") {
      const response = await loadPopularCategoryStreams({
        categoryId,
        language,
        cursor,
        limit,
        excludeFollowerOnly
      });

      return NextResponse.json({
        sort,
        data: response.data,
        cursor: response.cursor
      });
    }

    if (sort !== "low_to_high_exact") {
      return jsonError("Unsupported sort mode.", 400);
    }

    const snapshotResult = await loadExactCategoryStreams({
      categoryId,
      language,
      snapshotId,
      offset,
      limit,
      excludeFollowerOnly
    });

    const activeJob = findActiveRefreshJob(
      getCategoryFiltersHash({
        categoryId,
        categoryName: snapshotResult.snapshot?.categoryName ?? "",
        language
      })
    );

    return NextResponse.json({
      sort,
      data: snapshotResult.data,
      nextOffset: snapshotResult.nextOffset,
      snapshot: snapshotResult.snapshot
        ? {
            id: snapshotResult.snapshot.id,
            categoryId: snapshotResult.snapshot.categoryId,
            categoryName: snapshotResult.snapshot.categoryName,
            language: snapshotResult.snapshot.language,
            completedAt: snapshotResult.snapshot.completedAt,
            streamCount: snapshotResult.snapshot.streamCount,
            duplicateCount: snapshotResult.snapshot.duplicateCount
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
