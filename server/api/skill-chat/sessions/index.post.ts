import { apiError, requireAuth } from '~/server/utils/auth'
import { createSkillChatSession } from '~/server/utils/skillChatStore'
import type { SkillChatSessionCreateRequest, SkillChatSessionRecord } from '~/types/skillChat'

export default defineEventHandler(async (event): Promise<SkillChatSessionRecord> => {
  requireAuth(event)
  const body = await readBody(event).catch(() => ({})) as SkillChatSessionCreateRequest

  try {
    return createSkillChatSession(body)
  } catch (err) {
    apiError(500, (err as Error).message || '创建会话失败')
  }
})
