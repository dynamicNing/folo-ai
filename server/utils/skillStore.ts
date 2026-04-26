import { db } from './db'
import { DEFAULT_SKILL_DEFINITIONS } from './skillRegistry'
import type {
  Artifact,
  ApprovalRequest,
  ApprovalStatus,
  Provider,
  SkillCategory,
  SkillDefinitionDetail,
  SkillDefinitionSummary,
  SkillListParams,
  SkillOrigin,
  SkillRunDetail,
  SkillRunListParams,
  SkillRunListResponse,
  SkillRunSummary,
  SkillRunEvent,
  SkillSourceType,
  SkillStatus,
  SkillToolPolicy,
  SkillSourceMetadata,
  EngineType,
  RunStatus,
} from '../../types/skill'

interface SkillDefinitionRow {
  slug: string
  name: string
  description: string
  category: SkillCategory
  engine_type: EngineType
  source_type: SkillSourceType
  source_path: string | null
  source_origin: SkillOrigin
  source_label: string | null
  source_version: string | null
  source_metadata: string
  input_schema: string
  output_schema: string
  default_provider: Provider
  default_model: string
  tool_policy: string
  status: SkillStatus
  created_at: string
  updated_at: string
}

interface SkillRunRow {
  run_uid: string
  skill_slug: string
  skill_name: string | null
  provider: Provider
  engine_type: EngineType
  model: string
  status: RunStatus
  error_message: string | null
  input_json: string
  output_json: string
  token_usage_json: string
  cost_json: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
}

interface SkillRunEventRow {
  id: number
  run_uid: string
  seq: number
  event_type: string
  payload_json: string
  created_at: string
}

interface ApprovalRequestRow {
  id: number
  run_uid: string
  request_type: string
  scope: string
  human_message: string
  payload_json: string
  status: ApprovalStatus
  created_at: string
  decided_at: string | null
}

interface ArtifactRow {
  id: number
  run_uid: string
  kind: string
  title: string
  file_path: string | null
  content_text: string | null
  mime_type: string | null
  meta_json: string
  created_at: string
}

let skillSeeded = false

function parseJsonObject<T extends object>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T
  } catch {
    // ignore invalid JSON rows and fall back to defaults
  }
  return fallback
}

function rowToSkillSummary(row: SkillDefinitionRow): SkillDefinitionSummary {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    engine_type: row.engine_type,
    default_provider: row.default_provider,
    default_model: row.default_model,
    source_origin: row.source_origin,
    source_label: row.source_label,
    source_version: row.source_version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToSkillDetail(row: SkillDefinitionRow): SkillDefinitionDetail {
  return {
    ...rowToSkillSummary(row),
    source_type: row.source_type,
    source_path: row.source_path,
    source_metadata: parseJsonObject<SkillSourceMetadata>(row.source_metadata, {}),
    input_schema: parseJsonObject(row.input_schema, {}),
    output_schema: parseJsonObject(row.output_schema, {}),
    tool_policy: parseJsonObject<SkillToolPolicy>(row.tool_policy, {
      network: false,
      filesystem_read: false,
      filesystem_write: false,
      shell: false,
      browser: false,
      approval_required: false,
    }),
  }
}

function rowToRunSummary(row: SkillRunRow): SkillRunSummary {
  return {
    run_uid: row.run_uid,
    skill_slug: row.skill_slug,
    skill_name: row.skill_name,
    provider: row.provider,
    engine_type: row.engine_type,
    model: row.model,
    status: row.status,
    error_message: row.error_message,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    duration_ms: row.duration_ms,
  }
}

function rowToRunDetail(row: SkillRunRow): SkillRunDetail {
  return {
    ...rowToRunSummary(row),
    input: parseJsonObject(row.input_json, {}),
    output: parseJsonObject(row.output_json, {}),
    token_usage: parseJsonObject(row.token_usage_json, {}),
    cost: parseJsonObject(row.cost_json, {}),
  }
}

function rowToRunEvent(row: SkillRunEventRow): SkillRunEvent {
  return {
    id: row.id,
    run_uid: row.run_uid,
    seq: row.seq,
    event_type: row.event_type,
    payload: parseJsonObject(row.payload_json, {}),
    created_at: row.created_at,
  }
}

function rowToApprovalRequest(row: ApprovalRequestRow): ApprovalRequest {
  return {
    id: row.id,
    run_uid: row.run_uid,
    request_type: row.request_type,
    scope: row.scope,
    human_message: row.human_message,
    payload: parseJsonObject(row.payload_json, {}),
    status: row.status,
    created_at: row.created_at,
    decided_at: row.decided_at,
  }
}

function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    run_uid: row.run_uid,
    kind: row.kind,
    title: row.title,
    file_path: row.file_path,
    content_text: row.content_text,
    mime_type: row.mime_type,
    meta: parseJsonObject(row.meta_json, {}),
    created_at: row.created_at,
  }
}

const UPSERT_SKILL_DEFINITION_SQL = `
  INSERT INTO skill_definitions (
    slug, name, description, category, engine_type, source_type, source_path,
    source_origin, source_label, source_version, source_metadata,
    input_schema, output_schema, default_provider, default_model, tool_policy,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    engine_type = excluded.engine_type,
    source_type = excluded.source_type,
    source_path = excluded.source_path,
    source_origin = excluded.source_origin,
    source_label = excluded.source_label,
    source_version = excluded.source_version,
    source_metadata = excluded.source_metadata,
    input_schema = excluded.input_schema,
    output_schema = excluded.output_schema,
    default_provider = excluded.default_provider,
    default_model = excluded.default_model,
    tool_policy = excluded.tool_policy,
    status = excluded.status,
    updated_at = excluded.updated_at
`

export function upsertSkillDefinition(skill: SkillDefinitionDetail): void {
  db.prepare(UPSERT_SKILL_DEFINITION_SQL).run(
    skill.slug,
    skill.name,
    skill.description,
    skill.category,
    skill.engine_type,
    skill.source_type,
    skill.source_path,
    skill.source_origin,
    skill.source_label,
    skill.source_version,
    JSON.stringify(skill.source_metadata || {}),
    JSON.stringify(skill.input_schema),
    JSON.stringify(skill.output_schema || {}),
    skill.default_provider,
    skill.default_model,
    JSON.stringify(skill.tool_policy),
    skill.status,
    skill.created_at,
    skill.updated_at,
  )
}

function ensureSkillDefinitionsSeeded(): void {
  if (skillSeeded) return

  const tx = db.transaction(() => {
    for (const skill of DEFAULT_SKILL_DEFINITIONS) {
      upsertSkillDefinition(skill)
    }
  })

  tx()
  skillSeeded = true
}

export function listSkillDefinitions(params: SkillListParams = {}): SkillDefinitionSummary[] {
  ensureSkillDefinitionsSeeded()

  const where: string[] = []
  const args: Array<string> = []

  if (params.category) {
    where.push('category = ?')
    args.push(params.category)
  }
  if (params.status) {
    where.push('status = ?')
    args.push(params.status)
  }
  if (params.provider) {
    where.push('default_provider = ?')
    args.push(params.provider)
  }
  if (params.source_origin) {
    where.push('source_origin = ?')
    args.push(params.source_origin)
  }

  const sql = `
    SELECT slug, name, description, category, engine_type, source_type, source_path,
           source_origin, source_label, source_version, source_metadata,
           input_schema, output_schema, default_provider, default_model, tool_policy,
           status, created_at, updated_at
    FROM skill_definitions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, name ASC
  `

  const rows = db.prepare(sql).all(...args) as SkillDefinitionRow[]
  return rows.map(rowToSkillSummary)
}

export function getSkillDefinition(slug: string): SkillDefinitionDetail | null {
  ensureSkillDefinitionsSeeded()

  const row = db.prepare(`
    SELECT slug, name, description, category, engine_type, source_type, source_path,
           source_origin, source_label, source_version, source_metadata,
           input_schema, output_schema, default_provider, default_model, tool_policy,
           status, created_at, updated_at
    FROM skill_definitions
    WHERE slug = ?
    LIMIT 1
  `).get(slug) as SkillDefinitionRow | undefined

  return row ? rowToSkillDetail(row) : null
}

export function refreshSkillUpdatedAt(slug: string): void {
  db.prepare(`
    UPDATE skill_definitions
    SET updated_at = ?
    WHERE slug = ?
  `).run(new Date().toISOString(), slug)
}

export function listSkillRuns(params: SkillRunListParams = {}): SkillRunListResponse {
  ensureSkillDefinitionsSeeded()

  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(Math.max(1, Number(params.pageSize) || 20), 100)
  const offset = (page - 1) * pageSize

  const where: string[] = []
  const args: Array<string | number> = []

  if (params.skill_slug) {
    where.push('r.skill_slug = ?')
    args.push(params.skill_slug)
  }
  if (params.status) {
    where.push('r.status = ?')
    args.push(params.status)
  }
  if (params.provider) {
    where.push('r.provider = ?')
    args.push(params.provider)
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const countSql = `
    SELECT COUNT(*) AS count
    FROM skill_runs r
    ${whereClause}
  `
  const total = Number((db.prepare(countSql).get(...args) as { count: number } | undefined)?.count || 0)

  const listSql = `
    SELECT r.run_uid, r.skill_slug, d.name AS skill_name, r.provider, r.engine_type, r.model, r.status,
           r.error_message, r.input_json, r.output_json, r.token_usage_json, r.cost_json,
           r.created_at, r.started_at, r.finished_at, r.duration_ms
    FROM skill_runs r
    LEFT JOIN skill_definitions d ON d.slug = r.skill_slug
    ${whereClause}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ? OFFSET ?
  `
  const rows = db.prepare(listSql).all(...args, pageSize, offset) as SkillRunRow[]

  return {
    data: rows.map(rowToRunSummary),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export function getSkillRun(runUid: string): SkillRunDetail | null {
  ensureSkillDefinitionsSeeded()

  const row = db.prepare(`
    SELECT r.run_uid, r.skill_slug, d.name AS skill_name, r.provider, r.engine_type, r.model, r.status,
           r.error_message, r.input_json, r.output_json, r.token_usage_json, r.cost_json,
           r.created_at, r.started_at, r.finished_at, r.duration_ms
    FROM skill_runs r
    LEFT JOIN skill_definitions d ON d.slug = r.skill_slug
    WHERE r.run_uid = ?
    LIMIT 1
  `).get(runUid) as SkillRunRow | undefined

  return row ? rowToRunDetail(row) : null
}

function listSkillRunsByStatuses(statuses: RunStatus[]): SkillRunDetail[] {
  ensureSkillDefinitionsSeeded()
  if (!statuses.length) return []

  const placeholders = statuses.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT r.run_uid, r.skill_slug, d.name AS skill_name, r.provider, r.engine_type, r.model, r.status,
           r.error_message, r.input_json, r.output_json, r.token_usage_json, r.cost_json,
           r.created_at, r.started_at, r.finished_at, r.duration_ms
    FROM skill_runs r
    LEFT JOIN skill_definitions d ON d.slug = r.skill_slug
    WHERE r.status IN (${placeholders})
    ORDER BY r.created_at ASC, r.id ASC
  `).all(...statuses) as SkillRunRow[]

  return rows.map(rowToRunDetail)
}

export function listQueuedSkillRunsForRecovery(): SkillRunDetail[] {
  return listSkillRunsByStatuses(['queued'])
}

export function listRunningSkillRunsForRecovery(): SkillRunDetail[] {
  return listSkillRunsByStatuses(['running'])
}

export function getSkillRunStatus(runUid: string): RunStatus | null {
  const row = db.prepare('SELECT status FROM skill_runs WHERE run_uid = ? LIMIT 1').get(runUid) as { status?: RunStatus } | undefined
  return row?.status || null
}

export function listSkillRunEvents(runUid: string, opts: { since?: number; limit?: number } = {}): SkillRunEvent[] {
  const since = Math.max(0, Number(opts.since) || 0)
  const limit = Math.min(Math.max(1, Number(opts.limit) || 200), 1000)
  const rows = db.prepare(`
    SELECT id, run_uid, seq, event_type, payload_json, created_at
    FROM skill_run_events
    WHERE run_uid = ? AND seq > ?
    ORDER BY seq ASC
    LIMIT ?
  `).all(runUid, since, limit) as SkillRunEventRow[]

  return rows.map(rowToRunEvent)
}

export function listApprovalRequests(runUid: string): ApprovalRequest[] {
  const rows = db.prepare(`
    SELECT id, run_uid, request_type, scope, human_message, payload_json, status, created_at, decided_at
    FROM approval_requests
    WHERE run_uid = ?
    ORDER BY created_at DESC, id DESC
  `).all(runUid) as ApprovalRequestRow[]

  return rows.map(rowToApprovalRequest)
}

export function getApprovalRequest(id: number): ApprovalRequest | null {
  const row = db.prepare(`
    SELECT id, run_uid, request_type, scope, human_message, payload_json, status, created_at, decided_at
    FROM approval_requests
    WHERE id = ?
    LIMIT 1
  `).get(id) as ApprovalRequestRow | undefined

  return row ? rowToApprovalRequest(row) : null
}

export function listArtifacts(runUid: string): Artifact[] {
  const rows = db.prepare(`
    SELECT id, run_uid, kind, title, file_path, content_text, mime_type, meta_json, created_at
    FROM artifacts
    WHERE run_uid = ?
    ORDER BY created_at DESC, id DESC
  `).all(runUid) as ArtifactRow[]

  return rows.map(rowToArtifact)
}

function generateRunUid(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function appendSkillRunEvent(runUid: string, eventType: string, payload: Record<string, unknown> = {}): void {
  const seq = Number((db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM skill_run_events WHERE run_uid = ?').get(runUid) as { seq: number } | undefined)?.seq || 0) + 1
  db.prepare(`
    INSERT INTO skill_run_events (run_uid, seq, event_type, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    runUid,
    seq,
    eventType,
    JSON.stringify(payload),
    new Date().toISOString(),
  )
}

export function createSkillRun(input: {
  skill_slug: string
  provider: Provider
  engine_type: EngineType
  model: string
  payload: Record<string, unknown>
}): string {
  ensureSkillDefinitionsSeeded()
  const runUid = generateRunUid()
  const createdAt = new Date().toISOString()

  db.prepare(`
    INSERT INTO skill_runs (
      run_uid, skill_slug, provider, engine_type, model, status,
      input_json, output_json, token_usage_json, cost_json, created_at
    ) VALUES (?, ?, ?, ?, ?, 'queued', ?, '{}', '{}', '{}', ?)
  `).run(
    runUid,
    input.skill_slug,
    input.provider,
    input.engine_type,
    input.model,
    JSON.stringify(input.payload),
    createdAt,
  )

  return runUid
}

export function setSkillRunWaitingApproval(runUid: string): void {
  db.prepare(`
    UPDATE skill_runs
    SET status = 'waiting_approval'
    WHERE run_uid = ?
  `).run(runUid)
}

export function queueSkillRun(runUid: string): void {
  db.prepare(`
    UPDATE skill_runs
    SET status = 'queued'
    WHERE run_uid = ?
  `).run(runUid)
}

export function startSkillRun(runUid: string): void {
  db.prepare(`
    UPDATE skill_runs
    SET status = 'running', started_at = ?
    WHERE run_uid = ?
  `).run(new Date().toISOString(), runUid)
}

export function finishSkillRunSuccess(runUid: string, output: Record<string, unknown>): void {
  const now = new Date()
  const startedAt = db.prepare('SELECT started_at FROM skill_runs WHERE run_uid = ?').get(runUid) as { started_at?: string | null } | undefined
  const startedMs = startedAt?.started_at ? new Date(startedAt.started_at).getTime() : now.getTime()

  db.prepare(`
    UPDATE skill_runs
    SET status = 'succeeded',
        output_json = ?,
        finished_at = ?,
        duration_ms = ?
    WHERE run_uid = ?
  `).run(
    JSON.stringify(output),
    now.toISOString(),
    now.getTime() - startedMs,
    runUid,
  )
}

export function finishSkillRunFailure(runUid: string, errorMessage: string): void {
  const now = new Date()
  const startedAt = db.prepare('SELECT started_at FROM skill_runs WHERE run_uid = ?').get(runUid) as { started_at?: string | null } | undefined
  const startedMs = startedAt?.started_at ? new Date(startedAt.started_at).getTime() : now.getTime()

  db.prepare(`
    UPDATE skill_runs
    SET status = 'failed',
        error_message = ?,
        finished_at = ?,
        duration_ms = ?
    WHERE run_uid = ?
  `).run(
    errorMessage,
    now.toISOString(),
    now.getTime() - startedMs,
    runUid,
  )
}

export function cancelSkillRun(runUid: string, message: string): void {
  const now = new Date()
  const row = db.prepare('SELECT started_at, created_at FROM skill_runs WHERE run_uid = ?').get(runUid) as { started_at?: string | null; created_at?: string | null } | undefined
  const startedBase = row?.started_at || row?.created_at || now.toISOString()
  const startedMs = new Date(startedBase).getTime()

  db.prepare(`
    UPDATE skill_runs
    SET status = 'cancelled',
        error_message = ?,
        finished_at = ?,
        duration_ms = ?
    WHERE run_uid = ?
  `).run(
    message,
    now.toISOString(),
    now.getTime() - startedMs,
    runUid,
  )
}

export function createApprovalRequest(input: {
  runUid: string
  requestType: string
  scope: string
  humanMessage: string
  payload: Record<string, unknown>
}): ApprovalRequest {
  const createdAt = new Date().toISOString()
  const info = db.prepare(`
    INSERT INTO approval_requests (run_uid, request_type, scope, human_message, payload_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    input.runUid,
    input.requestType,
    input.scope,
    input.humanMessage,
    JSON.stringify(input.payload),
    createdAt,
  )

  const created = getApprovalRequest(Number(info.lastInsertRowid))
  if (!created) throw new Error('审批请求创建失败')
  return created
}

export function resolveApprovalRequest(id: number, status: Exclude<ApprovalStatus, 'pending'>): ApprovalRequest | null {
  const decidedAt = new Date().toISOString()
  db.prepare(`
    UPDATE approval_requests
    SET status = ?, decided_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(status, decidedAt, id)

  return getApprovalRequest(id)
}

export function createArtifact(input: {
  runUid: string
  kind: string
  title: string
  filePath?: string | null
  contentText?: string | null
  mimeType?: string | null
  meta?: Record<string, unknown>
}): Artifact {
  const createdAt = new Date().toISOString()
  const info = db.prepare(`
    INSERT INTO artifacts (run_uid, kind, title, file_path, content_text, mime_type, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.runUid,
    input.kind,
    input.title,
    input.filePath || null,
    input.contentText || null,
    input.mimeType || null,
    JSON.stringify(input.meta || {}),
    createdAt,
  )

  const row = db.prepare(`
    SELECT id, run_uid, kind, title, file_path, content_text, mime_type, meta_json, created_at
    FROM artifacts
    WHERE id = ?
  `).get(Number(info.lastInsertRowid)) as ArtifactRow | undefined

  if (!row) throw new Error('产物创建失败')
  return rowToArtifact(row)
}
