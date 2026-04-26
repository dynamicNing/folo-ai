import { db } from '~/server/utils/db'
import { requireAuth, apiError } from '~/server/utils/auth'

interface QueryBody {
  sql?: string
}

export default defineEventHandler(async (event) => {
  requireAuth(event)

  const body = await readBody(event).catch(() => ({})) as QueryBody
  const sql = body.sql?.trim()

  if (!sql) apiError(400, 'sql 不能为空')

  // 禁止危险操作
  const upper = sql.toUpperCase()
  const blocked = ['DROP ', 'TRUNCATE ', 'ALTER ', 'ATTACH ', 'DETACH ', 'PRAGMA ']
  for (const keyword of blocked) {
    if (upper.includes(keyword)) apiError(403, `不允许执行 ${keyword.trim()} 操作`)
  }

  try {
    const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('EXPLAIN')
    if (isSelect) {
      const rows = db.prepare(sql).all() as Record<string, unknown>[]
      return { rows }
    } else {
      const result = db.prepare(sql).run()
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid }
    }
  } catch (e) {
    apiError(400, (e as Error).message)
  }
})
