import { requireAuth } from '~/server/utils/auth'
import { listClaudeCodeSkills } from '~/server/utils/claudeCodeSkills'

export default defineEventHandler(async (event) => {
  requireAuth(event)
  return { data: await listClaudeCodeSkills() }
})
