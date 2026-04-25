import { apiError, requireAuth } from '~/server/utils/auth'
import { getSkillRun, listSkillRunEvents } from '~/server/utils/skillStore'
import type { SkillRunEvent } from '~/types/skill'

export default defineEventHandler((event): { data: SkillRunEvent[] } => {
  requireAuth(event)
  const runUid = getRouterParam(event, 'runUid') || ''
  if (!getSkillRun(runUid)) apiError(404, '运行记录不存在')

  const q = getQuery(event)
  return {
    data: listSkillRunEvents(runUid, {
      since: Number(q.since) || 0,
      limit: Number(q.limit) || 200,
    }),
  }
})
