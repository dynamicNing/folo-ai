import { getArticle } from '~/server/utils/fileStore'
import { isAuthenticated, apiError } from '~/server/utils/auth'

export default defineEventHandler(event => {
  const slug = getRouterParam(event, 'slug') || ''
  const item = getArticle(slug)
  if (!item) apiError(404, '文章不存在')
  if (!isAuthenticated(event) && item.status !== 'published') apiError(404, '文章不存在')
  return item
})
