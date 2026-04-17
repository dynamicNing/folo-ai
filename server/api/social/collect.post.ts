import { collect } from '~/server/utils/collector'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  requireAuth(event)
  try {
    const body = await readBody<{ platform?: string }>(event)
    return await collect(body?.platform)
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
