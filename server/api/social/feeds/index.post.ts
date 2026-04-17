import { addFeed } from '~/server/utils/collector'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  requireAuth(event)
  const body = await readBody<{ name?: string; url?: string }>(event)
  if (!body?.name || !body?.url) apiError(400, 'name 和 url 均必填')
  try { return addFeed(body.name, body.url) }
  catch (e) { apiError(400, (e as Error).message) }
})
