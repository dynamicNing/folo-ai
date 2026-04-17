import { getStatus } from '~/server/utils/collector'
import { apiError } from '~/server/utils/auth'

export default defineEventHandler(() => {
  try { return getStatus() }
  catch (e) { apiError(500, (e as Error).message) }
})
