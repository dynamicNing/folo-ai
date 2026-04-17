import { getFeeds } from '~/server/utils/collector'
import { apiError } from '~/server/utils/auth'

export default defineEventHandler(() => {
  try { return getFeeds() }
  catch (e) { apiError(500, (e as Error).message) }
})
