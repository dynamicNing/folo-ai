import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_DIR = path.resolve(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'articles.db')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

export const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    slug        TEXT PRIMARY KEY,
    repo_path   TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'uncategorized',
    title       TEXT NOT NULL,
    tags        TEXT NOT NULL DEFAULT '[]',
    date        TEXT,
    summary     TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'published',
    sha         TEXT,
    ai_fields   TEXT NOT NULL DEFAULT '[]',
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    status      TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    duration_ms INTEGER,
    added       INTEGER NOT NULL DEFAULT 0,
    modified    INTEGER NOT NULL DEFAULT 0,
    removed     INTEGER NOT NULL DEFAULT 0,
    total       INTEGER NOT NULL DEFAULT 0,
    processed   INTEGER NOT NULL DEFAULT 0,
    failed      INTEGER NOT NULL DEFAULT 0,
    message     TEXT,
    detail      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON sync_logs(started_at DESC);
`)
