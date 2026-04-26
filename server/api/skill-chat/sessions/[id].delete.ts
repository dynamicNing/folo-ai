import { apiError, requireAuth } from '~/server/utils/auth'
import { deleteSkillChatSession, getSkillChatSession } from '~/server/utils/skillChatStore'

export default defineEventHandler((event): { ok: true } => {
  requireAuth(event)
  const sessionId = getRouterParam(event, 'id') || ''
  if (!sessionId) apiError(400, 'session id 不能为空')
  if (!getSkillChatSession(sessionId)) apiError(404, '会话不存在')

  const ok = deleteSkillChatSession(sessionId)
  if (!ok) apiError(500, '删除会话失败')
  return { ok: true }
})
