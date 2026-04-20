import { getAuthPayload } from '~/server/utils/auth'

export default defineEventHandler(event => {
  const payload = getAuthPayload(event)
  if (!payload) return { authenticated: false as const }
  return { authenticated: true as const, role: payload.role }
})
