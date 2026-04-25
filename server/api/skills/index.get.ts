import { requireAuth } from '~/server/utils/auth'
import { listSkillDefinitions } from '~/server/utils/skillStore'
import type { Provider, SkillCategory, SkillDefinitionSummary, SkillOrigin, SkillStatus } from '~/types/skill'

export default defineEventHandler((event): { data: SkillDefinitionSummary[] } => {
  requireAuth(event)
  const q = getQuery(event)

  return {
    data: listSkillDefinitions({
      category: (q.category as SkillCategory | undefined) || '',
      status: (q.status as SkillStatus | undefined) || '',
      provider: (q.provider as Provider | undefined) || '',
      source_origin: (q.source_origin as SkillOrigin | undefined) || '',
    }),
  }
})
