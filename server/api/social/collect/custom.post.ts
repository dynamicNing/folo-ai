import { collectCustomFeeds } from '~/server/utils/collector'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  requireAuth(event)
  try { return await collectCustomFeeds() }
  catch (e) { apiError(500, (e as Error).message) }
})
