import { toggleFeed } from '~/server/utils/collector'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(event => {
  requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  try { return toggleFeed(id) }
  catch (e) { apiError(400, (e as Error).message) }
})
