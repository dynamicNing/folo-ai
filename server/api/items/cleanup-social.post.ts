import { db } from '~/server/utils/db'
import { requireAuth, apiError } from '~/server/utils/auth'

export default defineEventHandler(event => {
  requireAuth(event)

  try {
    const result = db.prepare("DELETE FROM articles WHERE category LIKE 'social/%'").run()
    return {
      ok: true,
      deleted: result.changes,
      message: `已删除 ${result.changes} 条旧的 social/* 分类记录`,
    }
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
