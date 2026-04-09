import { env, hasRedisUrl, inlineRefreshJobsEnabled } from "@/lib/env";
import { buildTwitchThumbnail } from "@/lib/formatters";
import { filtersHash as hashFilters } from "@/lib/hash";
import { getRefreshQueue } from "@/lib/jobs";
import {
  createRefreshJob,
  createSnapshotWithStreams,
  findActiveRefreshJob,
  getLatestSnapshot as getLatestSnapshotRecord,
  getRefreshJob,
  getSnapshotById as getSnapshotByIdRecord,
  updateRefreshJob
} from "@/lib/local-store";
import { RefreshJobStatus } from "@/lib/refresh-job-status";
import { getStreamsByCategory, type TwitchStream } from "@/lib/twitch";

export type CategoryFilter = {
  categoryId: string;
  categoryName: string;
  language?: string | null;
};

export function getCategoryFiltersHash(filter: CategoryFilter) {
  return hashFilters({
    categoryId: filter.categoryId,
    language: filter.language ?? null
  });
}

export async function getLatestSnapshot(filter: Pick<CategoryFilter, "categoryId" | "language">) {
  const filtersHash = getCategoryFiltersHash({
    categoryId: filter.categoryId,
    categoryName: "",
    language: filter.language
  });

  return getLatestSnapshotRecord(filtersHash);
}

export async function getSnapshotById(snapshotId: string) {
  return getSnapshotByIdRecord(snapshotId);
}

export async function createOrReuseRefreshJob(filter: CategoryFilter) {
  const filtersHash = getCategoryFiltersHash(filter);
  const existing = findActiveRefreshJob(filtersHash);

  if (existing) {
    return existing;
  }

  const job = createRefreshJob({
    filtersHash,
    categoryId: filter.categoryId,
    categoryName: filter.categoryName,
    language: filter.language
  });

  if (hasRedisUrl()) {
    await getRefreshQueue().add("refresh", { jobId: job.id }, { jobId: job.id, removeOnComplete: 25 });
  } else if (inlineRefreshJobsEnabled()) {
    void processRefreshJob(job.id);
  }

  return job;
}

function dedupeKey(stream: TwitchStream) {
  return `${stream.user_id}:${stream.id}`;
}

export async function processRefreshJob(jobId: string) {
  const job = getRefreshJob(jobId);

  if (!job) {
    throw new Error(`Refresh job ${jobId} was not found.`);
  }

  updateRefreshJob(jobId, {
    status: RefreshJobStatus.RUNNING,
    startedAt: new Date().toISOString(),
    error: null
  });

  try {
    const seen = new Set<string>();
    const streams: TwitchStream[] = [];
    let duplicateCount = 0;
    let pageCount = 0;
    let cursor: string | undefined;

    do {
      if (env.TWITCH_MAX_CRAWL_PAGES > 0 && pageCount >= env.TWITCH_MAX_CRAWL_PAGES) {
        break;
      }

      const response = await getStreamsByCategory({
        categoryId: job.categoryId,
        language: job.language,
        cursor
      });

      pageCount += 1;
      cursor = response.pagination?.cursor;

      for (const stream of response.data) {
        const key = dedupeKey(stream);
        if (seen.has(key)) {
          duplicateCount += 1;
          continue;
        }

        seen.add(key);
        streams.push(stream);
      }

      updateRefreshJob(jobId, {
        pageCount,
        streamCount: streams.length,
        duplicateCount
      });
    } while (cursor);

    streams.sort((left, right) => left.viewer_count - right.viewer_count || left.user_name.localeCompare(right.user_name));

    const snapshot = createSnapshotWithStreams({
      filtersHash: job.filtersHash,
      categoryId: job.categoryId,
      categoryName: job.categoryName,
      language: job.language,
      streamCount: streams.length,
      duplicateCount,
      streams: streams.map((stream, index) => ({
        rank: index + 1,
        streamId: stream.id,
        userId: stream.user_id,
        userLogin: stream.user_login,
        userName: stream.user_name,
        title: stream.title,
        viewerCount: stream.viewer_count,
        startedAt: new Date(stream.started_at).toISOString(),
        language: stream.language,
        thumbnailUrl: buildTwitchThumbnail(stream.thumbnail_url),
        categoryId: stream.game_id,
        categoryName: stream.game_name,
        isMature: stream.is_mature,
        tagsJson: JSON.stringify(stream.tags ?? [])
      }))
    });

    updateRefreshJob(jobId, {
      status: RefreshJobStatus.COMPLETED,
      pageCount,
      streamCount: streams.length,
      duplicateCount,
      completedAt: new Date().toISOString(),
      snapshotId: snapshot.id
    });
  } catch (error) {
    updateRefreshJob(jobId, {
      status: RefreshJobStatus.FAILED,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown refresh error"
    });

    throw error;
  }
}
