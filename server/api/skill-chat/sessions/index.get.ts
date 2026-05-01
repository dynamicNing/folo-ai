import { requireAuth } from '~/server/utils/auth'
import { listSkillChatSessions } from '~/server/utils/skillChatStore'
import type { SkillChatSessionRecord } from '~/types/skillChat'

export default defineEventHandler((event): { data: SkillChatSessionRecord[] } => {
  requireAuth(event)
  return {
    data: listSkillChatSessions(),
  }
})
