import { apiError, requireAuth } from '~/server/utils/auth'
import {
  appendSkillRunEvent,
  cancelSkillRun,
  getApprovalRequest,
  getSkillRun,
  resolveApprovalRequest,
} from '~/server/utils/skillStore'
import type { ApprovalRequest, SkillRunDetail } from '~/types/skill'

export default defineEventHandler((event): { run: SkillRunDetail; approval: ApprovalRequest } => {
  requireAuth(event)
  const runUid = getRouterParam(event, 'runUid') || ''
  const approvalId = Number(getRouterParam(event, 'id') || 0)

  const run = getSkillRun(runUid)
  if (!run) apiError(404, '运行记录不存在')
  if (run.status !== 'waiting_approval') apiError(400, '当前运行不处于待审批状态')

  const approval = getApprovalRequest(approvalId)
  if (!approval || approval.run_uid !== runUid) apiError(404, '审批请求不存在')
  if (approval.status !== 'pending') apiError(400, '审批请求已处理')

  const resolved = resolveApprovalRequest(approvalId, 'rejected')
  if (!resolved) apiError(500, '审批状态更新失败')

  cancelSkillRun(runUid, '审批被拒绝，任务已取消')
  appendSkillRunEvent(runUid, 'approval.rejected', {
    approval_id: approvalId,
    scope: resolved.scope,
  })
  appendSkillRunEvent(runUid, 'run.cancelled', {
    reason: 'approval_rejected',
  })

  const refreshedRun = getSkillRun(runUid)
  if (!refreshedRun) apiError(500, '运行记录不存在')
  return { run: refreshedRun, approval: resolved }
})
