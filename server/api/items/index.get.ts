import { listArticles } from '~/server/utils/fileStore'
import { isAuthenticated, apiError } from '~/server/utils/auth'
import type { ArticleStatus } from '~/types/article'

export default defineEventHandler(event => {
  const q = getQuery(event) as Record<string, string | undefined>
  const requestedStatus = (q.status || 'published') as ArticleStatus
  const effectiveStatus: ArticleStatus = isAuthenticated(event) ? requestedStatus : 'published'

  try {
    return listArticles({
      category: q.category,
      tag: q.tag,
      status: effectiveStatus,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    })
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
