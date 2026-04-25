import { apiError, requireAuth } from '~/server/utils/auth'
import { getSkillRun, listApprovalRequests } from '~/server/utils/skillStore'
import type { ApprovalRequest } from '~/types/skill'

export default defineEventHandler((event): { data: ApprovalRequest[] } => {
  requireAuth(event)
  const runUid = getRouterParam(event, 'runUid') || ''
  if (!getSkillRun(runUid)) apiError(404, '运行记录不存在')
  return { data: listApprovalRequests(runUid) }
})
