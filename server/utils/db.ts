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

  CREATE TABLE IF NOT EXISTS learning_topics (
    topic_slug              TEXT PRIMARY KEY,
    repo_path               TEXT NOT NULL,
    title                   TEXT NOT NULL,
    source_type             TEXT NOT NULL DEFAULT 'concept',
    description             TEXT NOT NULL DEFAULT '',
    learning_goals          TEXT NOT NULL DEFAULT '[]',
    tags                    TEXT NOT NULL DEFAULT '[]',
    total_chapters          INTEGER NOT NULL DEFAULT 0,
    estimated_read_minutes  INTEGER NOT NULL DEFAULT 0,
    content_html            TEXT NOT NULL DEFAULT '',
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learning_chapters (
    topic_slug          TEXT NOT NULL,
    chapter_slug        TEXT NOT NULL,
    repo_path           TEXT NOT NULL,
    chapter_no          INTEGER NOT NULL,
    title               TEXT NOT NULL,
    estimated_minutes   INTEGER NOT NULL DEFAULT 0,
    learning_goals      TEXT NOT NULL DEFAULT '[]',
    summary             TEXT NOT NULL DEFAULT '',
    content_html        TEXT NOT NULL DEFAULT '',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    PRIMARY KEY (topic_slug, chapter_slug)
  );

  CREATE INDEX IF NOT EXISTS idx_learning_topics_created_at
    ON learning_topics(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_learning_chapters_topic
    ON learning_chapters(topic_slug, chapter_no ASC);
`)
