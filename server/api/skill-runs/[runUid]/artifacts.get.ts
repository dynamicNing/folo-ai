import { apiError, requireAuth } from '~/server/utils/auth'
import { listArtifacts, getSkillRun } from '~/server/utils/skillStore'
import type { Artifact } from '~/types/skill'

export default defineEventHandler((event): { data: Artifact[] } => {
  requireAuth(event)
  const runUid = getRouterParam(event, 'runUid') || ''
  if (!getSkillRun(runUid)) apiError(404, '运行记录不存在')
  return { data: listArtifacts(runUid) }
})
