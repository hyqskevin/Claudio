CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  cover_url TEXT,
  duration_ms INTEGER,
  raw TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plays (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  song_id TEXT,
  action TEXT NOT NULL,
  scene TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  scene TEXT,
  status TEXT NOT NULL,
  input TEXT,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_items (
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

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  type TEXT NOT NULL,
  song_id TEXT,
  title TEXT,
  artist TEXT,
  cover_url TEXT,
  audio_url TEXT,
  text_field TEXT,
  reason TEXT,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id TEXT NOT NULL UNIQUE,
  title TEXT,
  artist TEXT,
  cover_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playback_state (
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
INSERT OR IGNORE INTO playback_state (id) VALUES (1);
