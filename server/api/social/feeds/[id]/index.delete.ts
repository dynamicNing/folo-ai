import { removeFeed } from '~/server/utils/collector'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(event => {
  requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  try { removeFeed(id); return { ok: true } }
  catch (e) { apiError(400, (e as Error).message) }
})
