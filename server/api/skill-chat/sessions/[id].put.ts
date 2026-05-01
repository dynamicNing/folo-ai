import { apiError, requireAuth } from '~/server/utils/auth'
import { getSkillChatSession, updateSkillChatSession } from '~/server/utils/skillChatStore'
import type { SkillChatSessionRecord, SkillChatSessionUpdateRequest } from '~/types/skillChat'

export default defineEventHandler(async (event): Promise<SkillChatSessionRecord> => {
  requireAuth(event)
  const sessionId = getRouterParam(event, 'id') || ''
  if (!sessionId) apiError(400, 'session id 不能为空')
  if (!getSkillChatSession(sessionId)) apiError(404, '会话不存在')

  const body = await readBody(event).catch(() => ({})) as Partial<SkillChatSessionUpdateRequest>
  const messages = Array.isArray(body.messages) ? body.messages : null
  if (!messages) apiError(400, 'messages 必须是数组')

  const updated = updateSkillChatSession(sessionId, {
    title: body.title,
    preview: body.preview,
    messageCount: body.messageCount,
    messages,
  })

  if (!updated) apiError(404, '会话不存在')
  return updated
})
