import { requireAuth } from '~/server/utils/auth'
import { syncBundledSkillCatalog } from '~/server/utils/skillCatalog'
import type { SkillCatalogSyncResponse } from '~/types/skill'

export default defineEventHandler((event): SkillCatalogSyncResponse => {
  requireAuth(event)
  return syncBundledSkillCatalog(true)
})
