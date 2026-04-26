import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_DIR = path.resolve(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'articles.db')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

export const db = new Database(DB_PATH)

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return rows.some(row => row.name === column)
}

function ensureColumn(table: string, column: string, definition: string): void {
  if (hasColumn(table, column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

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

  CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_app_settings_updated
    ON app_settings(updated_at DESC);

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

  CREATE TABLE IF NOT EXISTS skill_definitions (
    slug              TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL,
    category          TEXT NOT NULL,
    engine_type       TEXT NOT NULL,
    source_type       TEXT NOT NULL,
    source_path       TEXT,
    source_origin     TEXT NOT NULL DEFAULT 'builtin',
    source_label      TEXT,
    source_version    TEXT,
    source_metadata   TEXT NOT NULL DEFAULT '{}',
    input_schema      TEXT NOT NULL,
    output_schema     TEXT NOT NULL DEFAULT '{}',
    default_provider  TEXT NOT NULL,
    default_model     TEXT NOT NULL,
    tool_policy       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_skill_definitions_status
    ON skill_definitions(status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_skill_definitions_category
    ON skill_definitions(category, updated_at DESC);

  CREATE TABLE IF NOT EXISTS skill_versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_slug   TEXT NOT NULL,
    version      TEXT NOT NULL,
    prompt_text  TEXT NOT NULL,
    config_json  TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL,
    UNIQUE (skill_slug, version)
  );
  CREATE INDEX IF NOT EXISTS idx_skill_versions_skill
    ON skill_versions(skill_slug, created_at DESC);

  CREATE TABLE IF NOT EXISTS execution_profiles (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                  TEXT NOT NULL UNIQUE,
    name                  TEXT NOT NULL,
    provider              TEXT NOT NULL,
    engine_type           TEXT NOT NULL,
    model                 TEXT NOT NULL,
    reasoning_effort      TEXT,
    temperature           REAL,
    max_tokens            INTEGER,
    tool_policy_override  TEXT NOT NULL DEFAULT '{}',
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_execution_profiles_provider
    ON execution_profiles(provider, updated_at DESC);

  CREATE TABLE IF NOT EXISTS skill_runs (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    run_uid               TEXT NOT NULL UNIQUE,
    skill_slug            TEXT NOT NULL,
    skill_version_id      INTEGER,
    execution_profile_id  INTEGER,
    provider              TEXT NOT NULL,
    engine_type           TEXT NOT NULL,
    model                 TEXT NOT NULL,
    status                TEXT NOT NULL,
    input_json            TEXT NOT NULL,
    output_json           TEXT NOT NULL DEFAULT '{}',
    error_message         TEXT,
    started_at            TEXT,
    finished_at           TEXT,
    duration_ms           INTEGER,
    token_usage_json      TEXT NOT NULL DEFAULT '{}',
    cost_json             TEXT NOT NULL DEFAULT '{}',
    created_at            TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_skill_runs_created
    ON skill_runs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_skill_runs_skill
    ON skill_runs(skill_slug, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_skill_runs_status
    ON skill_runs(status, created_at DESC);

  CREATE TABLE IF NOT EXISTS skill_run_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_uid      TEXT NOT NULL,
    seq          INTEGER NOT NULL,
    event_type   TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_skill_run_events_run
    ON skill_run_events(run_uid, seq ASC);

  CREATE TABLE IF NOT EXISTS approval_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    run_uid       TEXT NOT NULL,
    request_type  TEXT NOT NULL,
    scope         TEXT NOT NULL,
    human_message TEXT NOT NULL,
    payload_json  TEXT NOT NULL,
    status        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    decided_at    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_approval_requests_run
    ON approval_requests(run_uid, created_at DESC);

  CREATE TABLE IF NOT EXISTS artifacts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_uid      TEXT NOT NULL,
    kind         TEXT NOT NULL,
    title        TEXT NOT NULL,
    file_path    TEXT,
    content_text TEXT,
    mime_type    TEXT,
    meta_json    TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_artifacts_run
    ON artifacts(run_uid, created_at DESC);

  CREATE TABLE IF NOT EXISTS admin_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    action     TEXT NOT NULL,
    table_name TEXT NOT NULL,
    pk_value   TEXT NOT NULL,
    old_data   TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_admin_logs_created
    ON admin_logs(created_at DESC);
`)

ensureColumn('skill_definitions', 'source_origin', `TEXT NOT NULL DEFAULT 'builtin'`)
ensureColumn('skill_definitions', 'source_label', 'TEXT')
ensureColumn('skill_definitions', 'source_version', 'TEXT')
ensureColumn('skill_definitions', 'source_metadata', `TEXT NOT NULL DEFAULT '{}'`)
