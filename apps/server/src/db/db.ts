import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbUrl = process.env.DATABASE_URL ?? "";
  let dbPath: string;

  if (dbUrl.startsWith("file:")) {
    dbPath = dbUrl.slice(5);
    // Ensure parent directory exists
    const parentDir = dirname(dbPath);
    if (parentDir && parentDir !== ".") {
      mkdirSync(parentDir, { recursive: true });
    }
  } else {
    const dataDir = join(__dirname, "../../data");
    mkdirSync(dataDir, { recursive: true });
    dbPath = join(dataDir, "ai-radio.sqlite");
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);

  // Migration: add missing columns to existing tables
  const migrations = [
    "ALTER TABLE playback_state ADD COLUMN shuffle INTEGER DEFAULT 0",
    "ALTER TABLE queue_items ADD COLUMN title TEXT",
    "ALTER TABLE queue_items ADD COLUMN artist TEXT",
    "ALTER TABLE queue_items ADD COLUMN cover_url TEXT",
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists — ignore
    }
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
