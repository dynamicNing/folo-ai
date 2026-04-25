import { recoverPendingSkillRuns } from '~/server/utils/skillRunQueue'

export default defineNitroPlugin(() => {
  recoverPendingSkillRuns()
})
