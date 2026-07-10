import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { env } from "@/lib/env";
import { RefreshJobStatus, type RefreshJobStatusValue } from "@/lib/refresh-job-status";

export type FavoriteRecord = {
  id: string;
  userId: string;
  channelId: string;
  broadcasterLogin: string;
  broadcasterName: string;
  thumbnailUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SnapshotStreamRecord = {
  id: string;
  snapshotId: string;
  rank: number;
  streamId: string;
  userId: string;
  userLogin: string;
  userName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  language: string;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
  isMature: number;
  tagsJson: string;
};

export type CategorySnapshotRecord = {
  id: string;
  filtersHash: string;
  categoryId: string;
  categoryName: string;
  language: string | null;
  streamCount: number;
  duplicateCount: number;
  completedAt: string;
  createdAt: string;
};

export type CategorySnapshotWithStreams = CategorySnapshotRecord & {
  streams: SnapshotStreamRecord[];
};

type SnapshotPagingInput = {
  offset?: number;
  limit?: number;
};

export type RefreshJobRecord = {
  id: string;
  filtersHash: string;
  categoryId: string;
  categoryName: string;
  language: string | null;
  status: RefreshJobStatusValue;
  pageCount: number;
  streamCount: number;
  duplicateCount: number;
  error: string | null;
  snapshotId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppPreferencesRecord = {
  ownerId: string;
  themeMode: string;
  categorySort: string;
  categoryLanguage: string | null;
  excludeFollowerOnly: number;
  playbackEngine: string;
  lowLatencyAutoFallback: number;
  lowLatencyCatchUp: number;
  autoOpenChat: number;
  chatAutoLogin: number;
  hoverPreview: number;
  mpegtsLowLatency: number;
  openInNewTab: number;
  createdAt: string;
  updatedAt: string;
};

export type BroadcasterChatSettingsRecord = {
  broadcasterId: string;
  followerMode: number;
  followerModeDuration: number | null;
  checkedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __localDb: DatabaseSync | undefined;
}

function resolveSqlitePath() {
  const configured = env.DATABASE_URL ?? "file:./dev.db";
  if (!configured.startsWith("file:")) {
    return path.join(process.cwd(), "prisma", "dev.db");
  }

  const target = configured.slice("file:".length);
  const baseDir = path.join(process.cwd(), "prisma");
  return path.resolve(baseDir, target || "./dev.db");
}

function initializeDatabase(db: DatabaseSync) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      broadcaster_login TEXT NOT NULL,
      broadcaster_name TEXT NOT NULL,
      thumbnail_url TEXT,
      category_id TEXT,
      category_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, channel_id)
    );

    CREATE INDEX IF NOT EXISTS favorites_user_created_idx
      ON favorites(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS category_snapshots (
      id TEXT PRIMARY KEY,
      filters_hash TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      language TEXT,
      stream_count INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS category_snapshots_filters_completed_idx
      ON category_snapshots(filters_hash, completed_at DESC);

    CREATE TABLE IF NOT EXISTS snapshot_streams (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      stream_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_login TEXT NOT NULL,
      user_name TEXT NOT NULL,
      title TEXT NOT NULL,
      viewer_count INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      language TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      is_mature INTEGER NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      UNIQUE(snapshot_id, stream_id),
      FOREIGN KEY(snapshot_id) REFERENCES category_snapshots(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS snapshot_streams_snapshot_rank_idx
      ON snapshot_streams(snapshot_id, rank);

    CREATE TABLE IF NOT EXISTS refresh_jobs (
      id TEXT PRIMARY KEY,
      filters_hash TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      language TEXT,
      status TEXT NOT NULL DEFAULT 'QUEUED',
      page_count INTEGER NOT NULL DEFAULT 0,
      stream_count INTEGER NOT NULL DEFAULT 0,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      snapshot_id TEXT,
      started_at TEXT,
      completed_at TEXT,
      failed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(snapshot_id) REFERENCES category_snapshots(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS refresh_jobs_filters_created_idx
      ON refresh_jobs(filters_hash, created_at DESC);

    CREATE INDEX IF NOT EXISTS refresh_jobs_status_created_idx
      ON refresh_jobs(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS app_preferences (
      owner_id TEXT PRIMARY KEY,
      theme_mode TEXT NOT NULL DEFAULT 'dark',
      category_sort TEXT NOT NULL DEFAULT 'popular',
      category_language TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS broadcaster_chat_settings (
      broadcaster_id TEXT PRIMARY KEY,
      follower_mode INTEGER NOT NULL DEFAULT 0,
      follower_mode_duration INTEGER,
      checked_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS broadcaster_chat_settings_checked_idx
      ON broadcaster_chat_settings(checked_at DESC);

    CREATE TABLE IF NOT EXISTS known_languages (
      language_code TEXT PRIMARY KEY
    );
  `);

  ensureColumnExists(db, "app_preferences", "exclude_follower_only", "INTEGER NOT NULL DEFAULT 0");
  ensureColumnExists(db, "app_preferences", "playback_engine", "TEXT NOT NULL DEFAULT 'lowlatency'");
  ensureColumnExists(db, "app_preferences", "low_latency_auto_fallback", "INTEGER NOT NULL DEFAULT 1");
  ensureColumnExists(db, "app_preferences", "low_latency_catch_up", "INTEGER NOT NULL DEFAULT 1");
  ensureColumnExists(db, "app_preferences", "auto_open_chat", "INTEGER NOT NULL DEFAULT 1");
  ensureColumnExists(db, "app_preferences", "chat_auto_login", "INTEGER NOT NULL DEFAULT 0");
  ensureColumnExists(db, "app_preferences", "hover_preview", "INTEGER NOT NULL DEFAULT 1");
  ensureColumnExists(db, "app_preferences", "mpegts_low_latency", "INTEGER NOT NULL DEFAULT 1");
  ensureColumnExists(db, "app_preferences", "open_in_new_tab", "INTEGER NOT NULL DEFAULT 0");
}

function ensureColumnExists(db: DatabaseSync, tableName: string, columnName: string, definition: string) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name?: string }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

export function getLocalDb() {
  if (!globalThis.__localDb) {
    const databasePath = resolveSqlitePath();
    mkdirSync(path.dirname(databasePath), { recursive: true });
    const db = new DatabaseSync(databasePath);
    initializeDatabase(db);
    globalThis.__localDb = db;
  }

  return globalThis.__localDb;
}

function nowIso() {
  return new Date().toISOString();
}

export function getAppPreferences(ownerId: string) {
  return getLocalDb()
    .prepare(`
      SELECT
        owner_id as ownerId,
        theme_mode as themeMode,
        category_sort as categorySort,
        category_language as categoryLanguage,
        exclude_follower_only as excludeFollowerOnly,
        playback_engine as playbackEngine,
        low_latency_auto_fallback as lowLatencyAutoFallback,
        low_latency_catch_up as lowLatencyCatchUp,
        auto_open_chat as autoOpenChat,
        chat_auto_login as chatAutoLogin,
        hover_preview as hoverPreview,
        mpegts_low_latency as mpegtsLowLatency,
        open_in_new_tab as openInNewTab,
        created_at as createdAt,
        updated_at as updatedAt
      FROM app_preferences
      WHERE owner_id = ?
      LIMIT 1
    `)
    .get(ownerId) as AppPreferencesRecord | undefined;
}

export function upsertAppPreferences(
  ownerId: string,
  input: {
    themeMode?: string;
    categorySort?: string;
    categoryLanguage?: string | null;
    excludeFollowerOnly?: boolean;
    playbackEngine?: string;
    lowLatencyAutoFallback?: boolean;
    lowLatencyCatchUp?: boolean;
    autoOpenChat?: boolean;
    chatAutoLogin?: boolean;
    hoverPreview?: boolean;
    mpegtsLowLatency?: boolean;
    openInNewTab?: boolean;
  }
) {
  const existing = getAppPreferences(ownerId);
  const timestamp = nowIso();

  getLocalDb().prepare(`
    INSERT INTO app_preferences (
      owner_id, theme_mode, category_sort, category_language, exclude_follower_only,
      playback_engine, low_latency_auto_fallback, low_latency_catch_up, auto_open_chat, chat_auto_login, hover_preview, mpegts_low_latency, open_in_new_tab, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id) DO UPDATE SET
      theme_mode = excluded.theme_mode,
      category_sort = excluded.category_sort,
      category_language = excluded.category_language,
      exclude_follower_only = excluded.exclude_follower_only,
      playback_engine = excluded.playback_engine,
      low_latency_auto_fallback = excluded.low_latency_auto_fallback,
      low_latency_catch_up = excluded.low_latency_catch_up,
      auto_open_chat = excluded.auto_open_chat,
      chat_auto_login = excluded.chat_auto_login,
      hover_preview = excluded.hover_preview,
      mpegts_low_latency = excluded.mpegts_low_latency,
      open_in_new_tab = excluded.open_in_new_tab,
      updated_at = excluded.updated_at
  `).run(
    ownerId,
    input.themeMode ?? existing?.themeMode ?? "dark",
    input.categorySort ?? existing?.categorySort ?? "popular",
    input.categoryLanguage ?? existing?.categoryLanguage ?? null,
    input.excludeFollowerOnly === undefined ? (existing?.excludeFollowerOnly ?? 0) : input.excludeFollowerOnly ? 1 : 0,
    input.playbackEngine ?? existing?.playbackEngine ?? "lowlatency",
    input.lowLatencyAutoFallback === undefined
      ? (existing?.lowLatencyAutoFallback ?? 1)
      : input.lowLatencyAutoFallback
        ? 1
        : 0,
    input.lowLatencyCatchUp === undefined
      ? (existing?.lowLatencyCatchUp ?? 1)
      : input.lowLatencyCatchUp
        ? 1
        : 0,
    input.autoOpenChat === undefined
      ? (existing?.autoOpenChat ?? 1)
      : input.autoOpenChat
        ? 1
        : 0,
    input.chatAutoLogin === undefined
      ? (existing?.chatAutoLogin ?? 0)
      : input.chatAutoLogin
        ? 1
        : 0,
    input.hoverPreview === undefined
      ? (existing?.hoverPreview ?? 1)
      : input.hoverPreview
        ? 1
        : 0,
    input.mpegtsLowLatency === undefined
      ? (existing?.mpegtsLowLatency ?? 1)
      : input.mpegtsLowLatency
        ? 1
        : 0,
    input.openInNewTab === undefined
      ? (existing?.openInNewTab ?? 0)
      : input.openInNewTab
        ? 1
        : 0,
    existing?.createdAt ?? timestamp,
    timestamp
  );

  return getAppPreferences(ownerId) as AppPreferencesRecord;
}

export function getBroadcasterChatSettings(broadcasterId: string) {
  return getLocalDb()
    .prepare(`
      SELECT
        broadcaster_id as broadcasterId,
        follower_mode as followerMode,
        follower_mode_duration as followerModeDuration,
        checked_at as checkedAt
      FROM broadcaster_chat_settings
      WHERE broadcaster_id = ?
      LIMIT 1
    `)
    .get(broadcasterId) as BroadcasterChatSettingsRecord | undefined;
}

export function upsertBroadcasterChatSettings(input: {
  broadcasterId: string;
  followerMode: boolean;
  followerModeDuration?: number | null;
  checkedAt?: string;
}) {
  const checkedAt = input.checkedAt ?? nowIso();

  getLocalDb().prepare(`
    INSERT INTO broadcaster_chat_settings (
      broadcaster_id, follower_mode, follower_mode_duration, checked_at
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(broadcaster_id) DO UPDATE SET
      follower_mode = excluded.follower_mode,
      follower_mode_duration = excluded.follower_mode_duration,
      checked_at = excluded.checked_at
  `).run(
    input.broadcasterId,
    input.followerMode ? 1 : 0,
    input.followerModeDuration ?? null,
    checkedAt
  );

  return getBroadcasterChatSettings(input.broadcasterId) as BroadcasterChatSettingsRecord;
}

export function listFavorites(userId: string) {
  const statement = getLocalDb().prepare(`
    SELECT
      id,
      user_id as userId,
      channel_id as channelId,
      broadcaster_login as broadcasterLogin,
      broadcaster_name as broadcasterName,
      thumbnail_url as thumbnailUrl,
      category_id as categoryId,
      category_name as categoryName,
      created_at as createdAt,
      updated_at as updatedAt
    FROM favorites
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);

  return statement.all(userId) as FavoriteRecord[];
}

export function upsertFavorite(
  userId: string,
  favorite: {
    channelId: string;
    broadcasterLogin: string;
    broadcasterName: string;
    thumbnailUrl?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
  }
) {
  const existing = getLocalDb()
    .prepare(`
      SELECT id
      FROM favorites
      WHERE user_id = ? AND channel_id = ?
      LIMIT 1
    `)
    .get(userId, favorite.channelId) as { id: string } | undefined;

  const timestamp = nowIso();
  const id = existing?.id ?? randomUUID();

  getLocalDb().prepare(`
    INSERT INTO favorites (
      id, user_id, channel_id, broadcaster_login, broadcaster_name,
      thumbnail_url, category_id, category_name, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, channel_id) DO UPDATE SET
      broadcaster_login = excluded.broadcaster_login,
      broadcaster_name = excluded.broadcaster_name,
      thumbnail_url = excluded.thumbnail_url,
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      updated_at = excluded.updated_at
  `).run(
    id,
    userId,
    favorite.channelId,
    favorite.broadcasterLogin,
    favorite.broadcasterName,
    favorite.thumbnailUrl ?? null,
    favorite.categoryId ?? null,
    favorite.categoryName ?? null,
    timestamp,
    timestamp
  );

  return getLocalDb()
    .prepare(`
      SELECT
        id,
        user_id as userId,
        channel_id as channelId,
        broadcaster_login as broadcasterLogin,
        broadcaster_name as broadcasterName,
        thumbnail_url as thumbnailUrl,
        category_id as categoryId,
        category_name as categoryName,
        created_at as createdAt,
        updated_at as updatedAt
      FROM favorites
      WHERE user_id = ? AND channel_id = ?
      LIMIT 1
    `)
    .get(userId, favorite.channelId) as FavoriteRecord;
}

export function deleteFavorite(userId: string, channelId: string) {
  getLocalDb()
    .prepare(`
      DELETE FROM favorites
      WHERE user_id = ? AND channel_id = ?
    `)
    .run(userId, channelId);
}

export function migrateFavoritesUserId(oldUserId: string, newUserId: string) {
  if (oldUserId === newUserId) return;
  getLocalDb()
    .prepare(`
      UPDATE favorites SET user_id = ? WHERE user_id = ?
    `)
    .run(newUserId, oldUserId);
}

export function findActiveRefreshJob(filtersHash: string) {
  return getLocalDb()
    .prepare(`
      SELECT
        id,
        filters_hash as filtersHash,
        category_id as categoryId,
        category_name as categoryName,
        language,
        status,
        page_count as pageCount,
        stream_count as streamCount,
        duplicate_count as duplicateCount,
        error,
        snapshot_id as snapshotId,
        started_at as startedAt,
        completed_at as completedAt,
        failed_at as failedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM refresh_jobs
      WHERE filters_hash = ? AND status IN (?, ?)
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(filtersHash, RefreshJobStatus.QUEUED, RefreshJobStatus.RUNNING) as RefreshJobRecord | undefined;
}

export function createRefreshJob(input: {
  filtersHash: string;
  categoryId: string;
  categoryName: string;
  language?: string | null;
}): RefreshJobRecord {
  const id = randomUUID();
  const timestamp = nowIso();

  getLocalDb().prepare(`
    INSERT INTO refresh_jobs (
      id, filters_hash, category_id, category_name, language, status,
      page_count, stream_count, duplicate_count, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
  `).run(
    id,
    input.filtersHash,
    input.categoryId,
    input.categoryName,
    input.language ?? null,
    RefreshJobStatus.QUEUED,
    timestamp,
    timestamp
  );

  const job = getRefreshJob(id);
  if (!job) {
    throw new Error(`Refresh job ${id} could not be loaded after creation.`);
  }

  return job;
}

export function getRefreshJob(jobId: string) {
  return getLocalDb()
    .prepare(`
      SELECT
        id,
        filters_hash as filtersHash,
        category_id as categoryId,
        category_name as categoryName,
        language,
        status,
        page_count as pageCount,
        stream_count as streamCount,
        duplicate_count as duplicateCount,
        error,
        snapshot_id as snapshotId,
        started_at as startedAt,
        completed_at as completedAt,
        failed_at as failedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM refresh_jobs
      WHERE id = ?
      LIMIT 1
    `)
    .get(jobId) as RefreshJobRecord | undefined;
}

export function updateRefreshJob(
  jobId: string,
  patch: Partial<{
    status: RefreshJobStatusValue;
    pageCount: number;
    streamCount: number;
    duplicateCount: number;
    error: string | null;
    snapshotId: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
  }>
) {
  const current = getRefreshJob(jobId);
  if (!current) {
    throw new Error(`Refresh job ${jobId} was not found.`);
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso()
  };

  getLocalDb().prepare(`
    UPDATE refresh_jobs
    SET
      status = ?,
      page_count = ?,
      stream_count = ?,
      duplicate_count = ?,
      error = ?,
      snapshot_id = ?,
      started_at = ?,
      completed_at = ?,
      failed_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    next.status,
    next.pageCount,
    next.streamCount,
    next.duplicateCount,
    next.error ?? null,
    next.snapshotId ?? null,
    next.startedAt ?? null,
    next.completedAt ?? null,
    next.failedAt ?? null,
    next.updatedAt,
    jobId
  );

  return getRefreshJob(jobId) as RefreshJobRecord;
}

export function getLatestSnapshot(filtersHash: string, paging?: SnapshotPagingInput) {
  const snapshot = getLocalDb()
    .prepare(`
      SELECT
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
      WHERE filters_hash = ?
      ORDER BY completed_at DESC
      LIMIT 1
    `)
    .get(filtersHash) as CategorySnapshotRecord | undefined;

  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    streams: getSnapshotStreams(snapshot.id, paging)
  };
}

export function getSnapshotById(snapshotId: string, paging?: SnapshotPagingInput) {
  const snapshot = getLocalDb()
    .prepare(`
      SELECT
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
    `)
    .get(snapshotId) as CategorySnapshotRecord | undefined;

  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    streams: getSnapshotStreams(snapshot.id, paging)
  };
}

function getSnapshotStreams(snapshotId: string, paging?: SnapshotPagingInput) {
  const offset = paging?.offset && paging.offset > 0 ? Math.floor(paging.offset) : 0;
  const limit = paging?.limit && paging.limit > 0 ? Math.floor(paging.limit) : -1;

  return getLocalDb()
    .prepare(`
      SELECT
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
      WHERE snapshot_id = ?
      ORDER BY rank ASC
      LIMIT ?
      OFFSET ?
    `)
    .all(snapshotId, limit, offset) as SnapshotStreamRecord[];
}

export function createSnapshotWithStreams(input: {
  filtersHash: string;
  categoryId: string;
  categoryName: string;
  language?: string | null;
  streamCount: number;
  duplicateCount: number;
  streams: Array<{
    rank: number;
    streamId: string;
    userId: string;
    userLogin: string;
    userName: string;
    title: string;
    viewerCount: number;
    startedAt: string;
    language: string;
    thumbnailUrl: string;
    categoryId: string;
    categoryName: string;
    isMature: boolean;
    tagsJson: string;
  }>;
}) {
  const db = getLocalDb();
  const snapshotId = randomUUID();
  const timestamp = nowIso();

  db.exec("BEGIN");

  try {
    db.prepare(`
      INSERT INTO category_snapshots (
        id, filters_hash, category_id, category_name, language,
        stream_count, duplicate_count, completed_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshotId,
      input.filtersHash,
      input.categoryId,
      input.categoryName,
      input.language ?? null,
      input.streamCount,
      input.duplicateCount,
      timestamp,
      timestamp
    );

    const insertStream = db.prepare(`
      INSERT INTO snapshot_streams (
        id, snapshot_id, rank, stream_id, user_id, user_login, user_name,
        title, viewer_count, started_at, language, thumbnail_url,
        category_id, category_name, is_mature, tags_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const stream of input.streams) {
      insertStream.run(
        randomUUID(),
        snapshotId,
        stream.rank,
        stream.streamId,
        stream.userId,
        stream.userLogin,
        stream.userName,
        stream.title,
        stream.viewerCount,
        stream.startedAt,
        stream.language,
        stream.thumbnailUrl,
        stream.categoryId,
        stream.categoryName,
        stream.isMature ? 1 : 0,
        stream.tagsJson
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getSnapshotById(snapshotId) as CategorySnapshotWithStreams;
}

export function getKnownLanguages() {
  const rows = getLocalDb()
    .prepare("SELECT language_code FROM known_languages ORDER BY language_code")
    .all() as Array<{ language_code: string }>;
  return rows.map((r) => r.language_code);
}

export function addKnownLanguages(codes: string[]) {
  const insert = getLocalDb().prepare(
    "INSERT OR IGNORE INTO known_languages (language_code) VALUES (?)"
  );
  for (const code of codes) {
    insert.run(code);
  }
}
