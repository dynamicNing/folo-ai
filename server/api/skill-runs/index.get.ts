import { requireAuth } from '~/server/utils/auth'
import { listSkillRuns } from '~/server/utils/skillStore'
import type { Provider, RunStatus, SkillRunListResponse } from '~/types/skill'

export default defineEventHandler((event): SkillRunListResponse => {
  requireAuth(event)
  const q = getQuery(event)
  return listSkillRuns({
    page: Number(q.page) || 1,
    pageSize: Number(q.pageSize) || 20,
    skill_slug: (q.skill_slug as string | undefined) || '',
    status: (q.status as RunStatus | undefined) || '',
    provider: (q.provider as Provider | undefined) || '',
  })
})
