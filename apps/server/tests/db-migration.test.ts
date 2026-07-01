import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { closeDb, getDb } from "../src/db/db.js";
import { unlinkSync } from "node:fs";

function createOldSchemaDb(path: string) {
  // Simulate a database created before the shuffle / title / artist / cover_url migrations
  const db = new Database(path);
  db.exec(`
    CREATE TABLE playback_state (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      current_song_id TEXT,
      current_song_name TEXT,
      current_song_artist TEXT,
      current_song_album TEXT,
      current_song_cover TEXT,
      progress_seconds REAL DEFAULT 0,
      queue_data TEXT,
      queue_index INTEGER DEFAULT 0,
      play_mode TEXT DEFAULT 'off',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO playback_state (id) VALUES (1);

    CREATE TABLE queue_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      type TEXT NOT NULL,
      song_id TEXT,
      tts_text TEXT,
      audio_url TEXT,
      reason TEXT,
      sort_order INTEGER NOT NULL,
      status TEXT NOT NULL
    );
  `);
  db.close();
}

function useTempDb() {
  const path = `/tmp/ai-radio-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  process.env.DATABASE_URL = `file:${path}`;
  closeDb();
  return {
    path,
    cleanup() {
      closeDb();
      try { unlinkSync(path); } catch {}
      try { unlinkSync(path + "-shm"); } catch {}
      try { unlinkSync(path + "-wal"); } catch {}
    },
  };
}

describe("db migrations", () => {
  describe("new database", () => {
    let dbCtx: ReturnType<typeof useTempDb>;

    beforeEach(() => {
      dbCtx = useTempDb();
    });

    afterEach(() => {
      dbCtx.cleanup();
    });

    it("creates all tables without error", () => {
      const db = getDb();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("playback_state");
      expect(tableNames).toContain("queue_items");
      expect(tableNames).toContain("songs");
      expect(tableNames).toContain("settings");
    });

    it("creates playback_state with shuffle column", () => {
      const db = getDb();
      const cols = db
        .prepare("PRAGMA table_info(playback_state)")
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("shuffle");
    });

    it("creates queue_items with title, artist, cover_url columns", () => {
      const db = getDb();
      const cols = db
        .prepare("PRAGMA table_info(queue_items)")
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("title");
      expect(colNames).toContain("artist");
      expect(colNames).toContain("cover_url");
    });
  });

  describe("existing database (missing columns)", () => {
    let dbCtx: ReturnType<typeof useTempDb>;

    beforeEach(() => {
      dbCtx = useTempDb();
      createOldSchemaDb(dbCtx.path);
    });

    afterEach(() => {
      dbCtx.cleanup();
    });

    it("migrates missing columns without throwing", () => {
      expect(() => getDb()).not.toThrow();
    });

    it("adds shuffle to playback_state", () => {
      const db = getDb();
      const cols = db
        .prepare("PRAGMA table_info(playback_state)")
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("shuffle");
    });

    it("adds title, artist, cover_url to queue_items", () => {
      const db = getDb();
      const cols = db
        .prepare("PRAGMA table_info(queue_items)")
        .all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("title");
      expect(colNames).toContain("artist");
      expect(colNames).toContain("cover_url");
    });
  });
});
