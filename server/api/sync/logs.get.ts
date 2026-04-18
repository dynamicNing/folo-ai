import { requireAuth } from '~/server/utils/auth'
import { listSyncLogs } from '~/server/utils/syncLog'

export default defineEventHandler(event => {
  requireAuth(event)
  const q = getQuery(event)
  const limit = Math.min(Number(q.limit) || 50, 200)
  return { data: listSyncLogs(limit) }
})
