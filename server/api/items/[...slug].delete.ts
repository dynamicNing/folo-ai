import { removeArticle } from '~/server/utils/fileStore'
import { apiError, requireAuth } from '~/server/utils/auth'

export default defineEventHandler(event => {
  requireAuth(event)
  const slug = getRouterParam(event, 'slug') || ''
  const ok = removeArticle(slug)
  if (!ok) apiError(404, '文章不存在')
  return { ok: true }
})
