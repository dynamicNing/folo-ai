import { requireAuth } from '~/server/utils/auth'
import { listSkillChatRunnableSkillSummaries } from '~/server/utils/skillChatSkills'
import type { SkillDefinitionSummary } from '~/types/skill'

export default defineEventHandler((event): { data: SkillDefinitionSummary[] } => {
  requireAuth(event)
  return {
    data: listSkillChatRunnableSkillSummaries(),
  }
})
