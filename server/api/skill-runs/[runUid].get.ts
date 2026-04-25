import { apiError, requireAuth } from '~/server/utils/auth'
import { getSkillRun } from '~/server/utils/skillStore'
import type { SkillRunDetail } from '~/types/skill'

export default defineEventHandler((event): SkillRunDetail => {
  requireAuth(event)
  const runUid = getRouterParam(event, 'runUid') || ''
  const run = getSkillRun(runUid)
  if (!run) apiError(404, '运行记录不存在')
  return run
})
