import { getDb } from "./db.js";

export interface QueueItemRow {
  id: string;
  plan_id: string | null;
  type: string;
  song_id: string | null;
  title: string | null;
  artist: string | null;
  cover_url: string | null;
  tts_text: string | null;
  audio_url: string | null;
  reason: string | null;
  sort_order: number;
  status: string;
}

export interface QueueItemWithMeta {
  id: string;
  plan_id: string | null;
  type: string;
  song_id: string | null;
  title: string | null;
  artist: string | null;
  cover_url: string | null;
  tts_text: string | null;
  audio_url: string | null;
  reason: string | null;
  sort_order: number;
  status: string;
}

export function serializeQueueItem(row: QueueItemWithMeta) {
  return {
    id: row.id,
    type: row.type as "song" | "tts",
    songId: row.song_id ?? undefined,
    title: row.title ?? undefined,
    artist: row.artist ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    text: row.tts_text ?? undefined,
    reason: row.reason ?? undefined,
    status: row.status as "pending" | "playing" | "played" | "skipped" | "failed",
  };
}

export function getQueueItems(): QueueItemRow[] {
  return getDb()
    .prepare("SELECT * FROM queue_items ORDER BY sort_order ASC")
    .all() as QueueItemRow[];
}

export function getQueueItemsWithMeta(): QueueItemWithMeta[] {
  return getDb()
    .prepare(
      `SELECT q.id, q.plan_id, q.type, q.song_id,
              COALESCE(q.title, s.title) AS title,
              COALESCE(q.artist, s.artist) AS artist,
              COALESCE(q.cover_url, s.cover_url) AS cover_url,
              q.tts_text, q.audio_url, q.reason, q.sort_order, q.status
       FROM queue_items q
       LEFT JOIN songs s ON q.song_id = s.id
       ORDER BY q.sort_order ASC`
    )
    .all() as QueueItemWithMeta[];
}

export function getCurrentItem(): QueueItemRow | undefined {
  return getDb()
    .prepare("SELECT * FROM queue_items WHERE status = 'playing' ORDER BY sort_order ASC LIMIT 1")
    .get() as QueueItemRow | undefined;
}

export function getCurrentItemWithMeta(): QueueItemWithMeta | undefined {
  return getDb()
    .prepare(
      `SELECT q.id, q.plan_id, q.type, q.song_id,
              COALESCE(q.title, s.title) AS title,
              COALESCE(q.artist, s.artist) AS artist,
              COALESCE(q.cover_url, s.cover_url) AS cover_url,
              q.tts_text, q.audio_url, q.reason, q.sort_order, q.status
       FROM queue_items q
       LEFT JOIN songs s ON q.song_id = s.id
       WHERE q.status = 'playing'
       ORDER BY q.sort_order ASC
       LIMIT 1`
    )
    .get() as QueueItemWithMeta | undefined;
}

export function setCurrentPlaying(itemId: string): void {
  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare("UPDATE queue_items SET status = 'pending' WHERE type = 'song'").run();
    db.prepare("UPDATE queue_items SET status = 'playing' WHERE id = ?").run(itemId);
  });
  txn();
}

export function addToQueue(item: {
  id: string;
  type: string;
  songId?: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
  text?: string;
  audioUrl?: string;
  reason?: string;
  planId?: string;
}): void {
  const row = getDb()
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM queue_items")
    .get() as { next_order: number };
  getDb()
    .prepare(
      "INSERT INTO queue_items (id, plan_id, type, song_id, title, artist, cover_url, tts_text, audio_url, reason, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
    )
    .run(
      item.id,
      item.planId ?? null,
      item.type,
      item.songId ?? null,
      item.title ?? null,
      item.artist ?? null,
      item.coverUrl ?? null,
      item.text ?? null,
      item.audioUrl ?? null,
      item.reason ?? null,
      row.next_order
    );
}

export function removeFromQueue(itemId: string): void {
  getDb().prepare("DELETE FROM queue_items WHERE id = ?").run(itemId);
}

export function clearQueue(): void {
  getDb().prepare("DELETE FROM queue_items").run();
}

export function skipToNext(): QueueItemRow | undefined {
  const db = getDb();
  const current = getCurrentItem();
  if (!current) return undefined;

  const next = db
    .prepare(
      "SELECT * FROM queue_items WHERE sort_order > ? AND type = 'song' ORDER BY sort_order ASC LIMIT 1"
    )
    .get(current.sort_order) as QueueItemRow | undefined;

  const txn = db.transaction(() => {
    db.prepare("UPDATE queue_items SET status = 'skipped' WHERE id = ?").run(current.id);
    if (next) {
      db.prepare("UPDATE queue_items SET status = 'playing' WHERE id = ?").run(next.id);
    }
  });
  txn();

  return next;
}

export function skipToPrevious(): QueueItemRow | undefined {
  const db = getDb();
  const current = getCurrentItem();
  if (!current) return undefined;

  const prev = db
    .prepare(
      "SELECT * FROM queue_items WHERE sort_order < ? AND type = 'song' ORDER BY sort_order DESC LIMIT 1"
    )
    .get(current.sort_order) as QueueItemRow | undefined;

  const txn = db.transaction(() => {
    db.prepare("UPDATE queue_items SET status = 'pending' WHERE id = ?").run(current.id);
    if (prev) {
      db.prepare("UPDATE queue_items SET status = 'playing' WHERE id = ?").run(prev.id);
    }
  });
  txn();

  return prev;
}

export function updateItemStatus(itemId: string, status: string): void {
  getDb().prepare("UPDATE queue_items SET status = ? WHERE id = ?").run(status, itemId);
}

export function insertPlanItems(
  planId: string,
  items: Array<{
    id: string;
    type: string;
    songId?: string;
    title?: string;
    artist?: string;
    coverUrl?: string;
    text?: string;
    audioUrl?: string;
    reason?: string;
  }>
): void {
  const db = getDb();
  const insertStmt = db.prepare(
    "INSERT INTO queue_items (id, plan_id, type, song_id, title, artist, cover_url, tts_text, audio_url, reason, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
  );

  const baseOrder = (
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM queue_items").get() as {
      next: number;
    }
  ).next;

  const txn = db.transaction(() => {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      insertStmt.run(
        item.id,
        planId,
        item.type,
        item.songId ?? null,
        item.title ?? null,
        item.artist ?? null,
        item.coverUrl ?? null,
        item.text ?? null,
        item.audioUrl ?? null,
        item.reason ?? null,
        baseOrder + i
      );
    }
  });
  txn();
}

export function replaceQueue(items: Array<{
  id: string;
  type: string;
  songId?: string;
  title?: string;
  artist?: string;
  coverUrl?: string;
  text?: string;
  audioUrl?: string;
  reason?: string;
  status?: string;
}>): void {
  const db = getDb();
  const deleteStmt = db.prepare("DELETE FROM queue_items");
  const insertStmt = db.prepare(
    "INSERT INTO queue_items (id, type, song_id, title, artist, cover_url, tts_text, audio_url, reason, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const txn = db.transaction(() => {
    deleteStmt.run();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      insertStmt.run(
        item.id,
        item.type,
        item.songId ?? null,
        item.title ?? null,
        item.artist ?? null,
        item.coverUrl ?? null,
        item.text ?? null,
        item.audioUrl ?? null,
        item.reason ?? null,
        i,
        item.status ?? "pending"
      );
    }
  });
  txn();
}
