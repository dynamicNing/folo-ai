import { apiError, requireAuth } from '~/server/utils/auth'
import { getSkillDefinition } from '~/server/utils/skillStore'
import type { SkillDefinitionDetail } from '~/types/skill'

export default defineEventHandler((event): SkillDefinitionDetail => {
  requireAuth(event)
  const slug = getRouterParam(event, 'slug') || ''
  const skill = getSkillDefinition(slug)
  if (!skill) apiError(404, '技能不存在')
  return skill
})
