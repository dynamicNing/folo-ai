import type { SkillDefinitionDetail, SkillDefinitionSummary } from '../../types/skill'
import { getSkillDefinition, listSkillDefinitions } from './skillStore'

type SkillChatRunnable = Pick<
  SkillDefinitionSummary,
  'source_origin' | 'status' | 'engine_type' | 'default_provider'
>

export function isSkillChatRunnable(skill: SkillChatRunnable): boolean {
  return skill.source_origin === 'builtin'
    && skill.status === 'active'
    && (skill.engine_type === 'llm_direct' || skill.engine_type === 'agent_sdk')
    && (skill.default_provider === 'anthropic' || skill.default_provider === 'openai')
}

export function listSkillChatRunnableSkillSummaries(): SkillDefinitionSummary[] {
  return listSkillDefinitions({ source_origin: 'builtin', status: 'active' })
    .filter(isSkillChatRunnable)
}

export function getSkillChatRunnableSkill(slug: string): SkillDefinitionDetail | null {
  const skill = getSkillDefinition(slug)
  if (!skill || !isSkillChatRunnable(skill)) return null
  return skill
}

export function listSkillChatRunnableSkillDetails(): SkillDefinitionDetail[] {
  return listSkillChatRunnableSkillSummaries()
    .map(skill => getSkillChatRunnableSkill(skill.slug))
    .filter((skill): skill is SkillDefinitionDetail => !!skill)
}
