const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'articles.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

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
`);

module.exports = db;
