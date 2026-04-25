import { apiError, requireAuth } from '~/server/utils/auth'
import { enqueueSkillRun } from '~/server/utils/skillRunQueue'
import {
  appendSkillRunEvent,
  createApprovalRequest,
  createSkillRun,
  getSkillDefinition,
  getSkillRun,
  setSkillRunWaitingApproval,
} from '~/server/utils/skillStore'
import type { Provider, SkillRunCreateRequest, SkillRunDetail } from '~/types/skill'

export default defineEventHandler(async (event): Promise<SkillRunDetail> => {
  requireAuth(event)
  const body = await readBody(event).catch(() => ({})) as Partial<SkillRunCreateRequest>

  const skillSlug = body.skill_slug?.trim() || ''
  if (!skillSlug) apiError(400, 'skill_slug 不能为空')

  const skill = getSkillDefinition(skillSlug)
  if (!skill) apiError(404, '技能不存在')
  if (skill.status !== 'active') apiError(400, '技能已禁用')
  if (skill.source_origin !== 'builtin') apiError(400, '当前仅内置 skill 支持直接运行，外部 skill 仅纳入目录管理')
  if (skill.engine_type !== 'llm_direct' && skill.engine_type !== 'agent_sdk') {
    apiError(400, '当前阶段暂不支持该 skill 引擎')
  }

  const payload = body.input && typeof body.input === 'object' && !Array.isArray(body.input)
    ? body.input as Record<string, unknown>
    : {}
  const provider = (body.provider || skill.default_provider) as Provider
  if (provider !== 'openai' && provider !== 'anthropic') apiError(400, 'provider 仅支持 openai 或 anthropic')
  const model = body.model?.trim() || skill.default_model

  const runUid = createSkillRun({
    skill_slug: skill.slug,
    provider,
    engine_type: skill.engine_type,
    model,
    payload,
  })
  appendSkillRunEvent(runUid, 'run.created', {
    skill_slug: skill.slug,
    provider,
    model,
  })

  if (skill.tool_policy.approval_required) {
    const approval = createApprovalRequest({
      runUid,
      requestType: 'skill_run',
      scope: [
        skill.tool_policy.network ? 'network' : null,
        skill.tool_policy.filesystem_read ? 'filesystem_read' : null,
        skill.tool_policy.filesystem_write ? 'filesystem_write' : null,
        skill.tool_policy.shell ? 'shell' : null,
        skill.tool_policy.browser ? 'browser' : null,
      ].filter(Boolean).join(',') || 'manual_review',
      humanMessage: `技能 ${skill.name} 需要审批后才能执行`,
      payload: {
        skill_slug: skill.slug,
        provider,
        model,
        tool_policy: skill.tool_policy,
      },
    })
    setSkillRunWaitingApproval(runUid)
    appendSkillRunEvent(runUid, 'approval.requested', {
      approval_id: approval.id,
      scope: approval.scope,
      message: approval.human_message,
    })
  } else {
    enqueueSkillRun({
      runUid,
      skill,
      input: payload,
      provider,
      model,
    })
  }

  const run = getSkillRun(runUid)
  if (!run) apiError(500, '运行记录写入失败')
  return run
})
