import { getItems } from '~/server/utils/collector'
import { apiError } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  const q = getQuery(event) as Record<string, string | undefined>
  try {
    return await getItems({
      platform: q.platform,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
    })
  } catch (e) {
    apiError(500, (e as Error).message)
  }
})
