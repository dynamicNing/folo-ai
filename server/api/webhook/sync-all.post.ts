import { syncAll } from '~/server/utils/contentPipeline'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  requireAuth(event)
  try {
    const result = await syncAll()
    return { ok: true, ...result }
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
