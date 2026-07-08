import type { CategorySnapshotWithStreams, SnapshotStreamRecord } from "@/lib/local-store";
import { normalizeLanguageCode } from "@/lib/formatters";
import { getSnapshotById } from "@/lib/local-store";
import {
  FOLLOWER_ONLY_LOOKUP_CONCURRENCY,
  getFollowerModeForBroadcasterId,
  mapWithConcurrency
} from "@/lib/follower-mode";
import { getLatestSnapshot } from "@/lib/refresh";
import { serializeSnapshotStream, serializeTwitchStream } from "@/lib/serializers";
import { getStreamsByCategory, type TwitchStream } from "@/lib/twitch";

const FOLLOWER_ONLY_SCAN_MULTIPLIER = 3;
const LANGUAGE_DISCOVERY_PAGES = 5;
const LANGUAGE_DISCOVERY_PAGE_SIZE = 100;

type SnapshotMeta = Omit<CategorySnapshotWithStreams, "streams">;

async function filterFollowerOnlyItems<T>(
  items: T[],
  getBroadcasterId: (item: T) => string,
  excludeFollowerOnly: boolean
) {
  if (!excludeFollowerOnly || items.length === 0) {
    return items;
  }

  const broadcasterIds = Array.from(new Set(items.map(getBroadcasterId).filter(Boolean)));
  const followerModes = await mapWithConcurrency(
    broadcasterIds,
    FOLLOWER_ONLY_LOOKUP_CONCURRENCY,
    getFollowerModeForBroadcasterId
  );

  const followerModeMap = new Map<string, boolean | null>();
  for (let index = 0; index < broadcasterIds.length; index += 1) {
    followerModeMap.set(broadcasterIds[index], followerModes[index]);
  }

  return items.filter((item) => followerModeMap.get(getBroadcasterId(item)) !== true);
}

function buildSnapshotMeta(snapshot: CategorySnapshotWithStreams): SnapshotMeta {
  const { streams: _streams, ...snapshotMeta } = snapshot;
  return snapshotMeta;
}

function collectNormalizedLanguages(values: string[]) {
  return Array.from(
    new Set(values.map((value) => normalizeLanguageCode(value)).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right));
}

export async function discoverCategoryLanguages(categoryId: string) {
  const languages = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < LANGUAGE_DISCOVERY_PAGES; page += 1) {
    const response = await getStreamsByCategory({
      categoryId,
      cursor,
      limit: LANGUAGE_DISCOVERY_PAGE_SIZE
    });

    for (const stream of response.data) {
      const language = normalizeLanguageCode(stream.language);
      if (language) {
        languages.add(language);
      }
    }

    cursor = response.pagination?.cursor;
    if (!cursor || response.data.length === 0) {
      break;
    }
  }

  return collectNormalizedLanguages([...languages]);
}

export async function loadPopularCategoryStreams(input: {
  categoryId: string;
  language?: string;
  cursor?: string;
  limit: number;
  excludeFollowerOnly: boolean;
}) {
  if (!input.excludeFollowerOnly) {
    const response = await getStreamsByCategory({
      categoryId: input.categoryId,
      language: input.language,
      cursor: input.cursor,
      limit: input.limit
    });

    return {
      data: response.data.map(serializeTwitchStream),
      cursor: response.pagination?.cursor ?? null
    };
  }

  const streams: TwitchStream[] = [];
  const maxScannedStreams = Math.max(input.limit * FOLLOWER_ONLY_SCAN_MULTIPLIER, input.limit);
  let cursor = input.cursor;
  let scannedStreams = 0;

  while (streams.length < input.limit && scannedStreams < maxScannedStreams) {
    const remaining = input.limit - streams.length;
    const response = await getStreamsByCategory({
      categoryId: input.categoryId,
      language: input.language,
      cursor,
      limit: remaining
    });

    cursor = response.pagination?.cursor;
    if (response.data.length === 0) {
      break;
    }

    scannedStreams += response.data.length;
    const filteredStreams = await filterFollowerOnlyItems(response.data, (stream) => stream.user_id, true);
    streams.push(...filteredStreams);

    if (!cursor) {
      break;
    }
  }

  return {
    data: streams.map(serializeTwitchStream),
    cursor: cursor ?? null
  };
}

export async function loadExactCategoryStreams(input: {
  categoryId: string;
  language?: string;
  snapshotId?: string;
  offset: number;
  limit: number;
  excludeFollowerOnly: boolean;
}) {
  const firstSnapshot = input.snapshotId
    ? getSnapshotById(input.snapshotId, {
        offset: input.offset,
        limit: input.limit
      })
    : await getLatestSnapshot(
        {
          categoryId: input.categoryId,
          language: input.language
        },
        {
          offset: input.offset,
          limit: input.limit
        }
      );

  if (!firstSnapshot) {
    return {
      data: [],
      nextOffset: null,
      snapshot: null
    };
  }

  if (!input.excludeFollowerOnly) {
    const nextOffset =
      input.offset + firstSnapshot.streams.length < firstSnapshot.streamCount
        ? input.offset + firstSnapshot.streams.length
        : null;

    return {
      data: firstSnapshot.streams.map(serializeSnapshotStream),
      nextOffset,
      snapshot: buildSnapshotMeta(firstSnapshot)
    };
  }

  const streams: SnapshotStreamRecord[] = [];
  const maxScannedStreams = Math.max(input.limit * FOLLOWER_ONLY_SCAN_MULTIPLIER, input.limit);
  const snapshotMeta = buildSnapshotMeta(firstSnapshot);
  let currentOffset = input.offset;
  let scannedStreams = 0;
  let pageSnapshot: CategorySnapshotWithStreams | null = firstSnapshot;

  while (streams.length < input.limit && currentOffset < snapshotMeta.streamCount && scannedStreams < maxScannedStreams) {
    const currentPage: CategorySnapshotWithStreams | null =
      pageSnapshot && currentOffset === input.offset
        ? pageSnapshot
        : getSnapshotById(snapshotMeta.id, {
            offset: currentOffset,
            limit: input.limit - streams.length
          });

    if (!currentPage || currentPage.streams.length === 0) {
      break;
    }

    pageSnapshot = currentPage;
    currentOffset += currentPage.streams.length;
    scannedStreams += currentPage.streams.length;

    const filteredStreams = await filterFollowerOnlyItems(currentPage.streams, (stream) => stream.userId, true);
    streams.push(...filteredStreams);
  }

  return {
    data: streams.map(serializeSnapshotStream),
    nextOffset: currentOffset < snapshotMeta.streamCount ? currentOffset : null,
    snapshot: snapshotMeta
  };
}
