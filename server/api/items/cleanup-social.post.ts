import { db } from '~/server/utils/db'
import { requireAuth, apiError } from '~/server/utils/auth'

export default defineEventHandler(event => {
  requireAuth(event)

  try {
    const result = db.prepare('DELETE FROM articles WHERE category LIKE "social/%"').run()
    return {
      ok: true,
      deleted: result.changes,
      message: `已删除 ${result.changes} 条 social/* 标签的文章`,
    }
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
