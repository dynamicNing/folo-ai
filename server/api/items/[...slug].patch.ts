import { updateArticleStatus } from '~/server/utils/fileStore'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  requireAuth(event)
  const slug = getRouterParam(event, 'slug') || ''
  const body = await readBody<{ status?: string }>(event)
  try {
    const ok = updateArticleStatus(slug, body?.status || '')
    if (!ok) apiError(404, '文章不存在')
    return { ok: true }
  } catch (e) {
    apiError(400, (e as Error).message)
  }
})
