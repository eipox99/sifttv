import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getLocalDb, type SnapshotStreamRecord } from "@/lib/local-store";
import { serializeSnapshotStream } from "@/lib/serializers";
import { getCategoryFiltersHash } from "@/lib/refresh";
import { findActiveRefreshJob } from "@/lib/local-store";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await context.params;
  const snapshotId = request.nextUrl.searchParams.get("snapshotId");
  const knownIdsParam = request.nextUrl.searchParams.get("knownIds") ?? "";
  const knownIds = knownIdsParam ? knownIdsParam.split(",").filter(Boolean) : [];

  if (!snapshotId) {
    return jsonError("snapshotId is required.", 400);
  }

  try {
    const db = getLocalDb();
    const snapshotRow = db.prepare(
      `SELECT
        id,
        filters_hash as filtersHash,
        category_id as categoryId,
        category_name as categoryName,
        language,
        stream_count as streamCount,
        duplicate_count as duplicateCount,
        completed_at as completedAt,
        created_at as createdAt
      FROM category_snapshots
      WHERE id = ?
      LIMIT 1
    `).get(snapshotId) as {
      id: string;
      filtersHash: string;
      categoryId: string;
      categoryName: string;
      language: string | null;
      streamCount: number;
      duplicateCount: number;
      completedAt: string;
      createdAt: string;
    } | undefined;

    if (!snapshotRow) {
      return jsonError("Snapshot not found.", 404);
    }

    const allRows = db.prepare(
      `SELECT stream_id FROM snapshot_streams WHERE snapshot_id = ? ORDER BY rank ASC`
    ).all(snapshotId) as { stream_id: string }[];

    const allStreamIds = new Set(allRows.map((r) => r.stream_id));
    const knownIdSet = new Set(knownIds);

    const removedIds = knownIds.filter((id) => !allStreamIds.has(id));
    const newStreamIds = allRows.filter((r) => !knownIdSet.has(r.stream_id)).map((r) => r.stream_id);

    let newStreams: ReturnType<typeof serializeSnapshotStream>[] = [];
    if (newStreamIds.length > 0) {
      const placeholders = newStreamIds.map(() => "?").join(",");
      const rows = db.prepare(
        `SELECT
          id,
          snapshot_id as snapshotId,
          rank,
          stream_id as streamId,
          user_id as userId,
          user_login as userLogin,
          user_name as userName,
          title,
          viewer_count as viewerCount,
          started_at as startedAt,
          language,
          thumbnail_url as thumbnailUrl,
          category_id as categoryId,
          category_name as categoryName,
          is_mature as isMature,
          tags_json as tagsJson
        FROM snapshot_streams
        WHERE snapshot_id = ? AND stream_id IN (${placeholders})
        ORDER BY rank ASC`
      ).all(snapshotId, ...newStreamIds) as SnapshotStreamRecord[];

      newStreams = rows.map(serializeSnapshotStream);
    }

    const activeJob = findActiveRefreshJob(
      getCategoryFiltersHash({
        categoryId,
        categoryName: snapshotRow.categoryName,
        language: snapshotRow.language
      })
    );

    return NextResponse.json({
      removedIds,
      newStreams,
      snapshot: {
        id: snapshotRow.id,
        categoryId: snapshotRow.categoryId,
        categoryName: snapshotRow.categoryName,
        language: snapshotRow.language,
        completedAt: snapshotRow.completedAt,
        streamCount: snapshotRow.streamCount,
        duplicateCount: snapshotRow.duplicateCount
      },
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
    return jsonError(error instanceof Error ? error.message : "Failed to compute snapshot delta.", 500);
  }
}

