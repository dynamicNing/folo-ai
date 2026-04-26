import { db } from '~/server/utils/db'
import { requireAuth, apiError } from '~/server/utils/auth'

interface BatchDeleteBody {
  table?: string
  pk?: string
  ids?: unknown[]
}

const ALLOWED_TABLES: Record<string, string> = {
  articles: 'slug',
  learning_topics: 'topic_slug',
  learning_chapters: 'chapter_slug',
  skill_definitions: 'slug',
  skill_runs: 'run_uid',
  sync_logs: 'id',
  app_settings: 'key',
  artifacts: 'id',
  skill_run_events: 'id',
  approval_requests: 'id',
  admin_logs: 'id',
}

const BATCH_SIZE = 100

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = await readBody(event).catch(() => ({})) as BatchDeleteBody
  const { table, pk, ids } = body

  if (!table || !pk || !Array.isArray(ids) || ids.length === 0) {
    apiError(400, '参数不完整：需要 table、pk、ids')
  }

  const expectedPk = ALLOWED_TABLES[table]
  if (!expectedPk) apiError(403, `不允许操作表：${table}`)
  if (pk !== expectedPk) apiError(403, `主键不匹配：${table} 的主键应为 ${expectedPk}`)

  try {
    let totalDeleted = 0
    const now = new Date().toISOString()

    // 分批处理，每批最多 BATCH_SIZE 条
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE)

      // 删除前读取旧数据用于日志
      const placeholders = batch.map(() => '?').join(',')
      const oldRows = db.prepare(
        `SELECT * FROM ${table} WHERE ${pk} IN (${placeholders})`
      ).all(...batch) as Record<string, unknown>[]

      // 执行删除
      const result = db.prepare(
        `DELETE FROM ${table} WHERE ${pk} IN (${placeholders})`
      ).run(...batch)
      totalDeleted += result.changes

      // 写入操作日志
      const insertLog = db.prepare(
        `INSERT INTO admin_logs (action, table_name, pk_value, old_data, created_at)
         VALUES ('delete', ?, ?, ?, ?)`
      )
      const logTx = db.transaction(() => {
        for (const row of oldRows) {
          insertLog.run(table, String(row[pk] ?? ''), JSON.stringify(row), now)
        }
      })
      logTx()
    }

    return { ok: true, deleted: totalDeleted }
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
