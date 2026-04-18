import { db } from './db'

export type SyncSource = 'manual' | 'webhook' | 'cli'
export type SyncStatus = 'success' | 'failed' | 'partial'

export interface SyncLogInput {
  source: SyncSource
  added?: number
  modified?: number
  removed?: number
  total?: number
  processed?: number
  failed?: number
  detail?: unknown
}

export interface SyncLogFinish {
  status: SyncStatus
  processed?: number
  failed?: number
  total?: number
  added?: number
  modified?: number
  removed?: number
  message?: string
  detail?: unknown
}

export interface SyncLogRow {
  id: number
  source: SyncSource
  status: SyncStatus | 'running'
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  added: number
  modified: number
  removed: number
  total: number
  processed: number
  failed: number
  message: string | null
  detail: string | null
}

export function startSyncLog(input: SyncLogInput): number {
  const startedAt = new Date().toISOString()
  const info = db.prepare(`
    INSERT INTO sync_logs (source, status, started_at, added, modified, removed, total, processed, failed, detail)
    VALUES (?, 'running', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.source,
    startedAt,
    input.added ?? 0,
    input.modified ?? 0,
    input.removed ?? 0,
    input.total ?? 0,
    input.processed ?? 0,
    input.failed ?? 0,
    input.detail ? JSON.stringify(input.detail) : null,
  )
  return Number(info.lastInsertRowid)
}

export function finishSyncLog(id: number, result: SyncLogFinish): void {
  const row = db.prepare('SELECT started_at FROM sync_logs WHERE id = ?').get(id) as { started_at?: string } | undefined
  const startedAt = row?.started_at ? new Date(row.started_at).getTime() : Date.now()
  const finishedAt = new Date()
  const duration = finishedAt.getTime() - startedAt

  db.prepare(`
    UPDATE sync_logs SET
      status = ?, finished_at = ?, duration_ms = ?,
      added = COALESCE(?, added), modified = COALESCE(?, modified), removed = COALESCE(?, removed),
      total = COALESCE(?, total), processed = COALESCE(?, processed), failed = COALESCE(?, failed),
      message = ?, detail = COALESCE(?, detail)
    WHERE id = ?
  `).run(
    result.status,
    finishedAt.toISOString(),
    duration,
    result.added ?? null,
    result.modified ?? null,
    result.removed ?? null,
    result.total ?? null,
    result.processed ?? null,
    result.failed ?? null,
    result.message ?? null,
    result.detail !== undefined ? JSON.stringify(result.detail) : null,
    id,
  )
}

export function listSyncLogs(limit = 50): SyncLogRow[] {
  return db.prepare('SELECT * FROM sync_logs ORDER BY id DESC LIMIT ?').all(limit) as SyncLogRow[]
}
