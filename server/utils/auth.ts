import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'

export function requireAuth(event: H3Event): { role: string } {
  const header = getHeader(event, 'authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '未登录', data: { error: '未登录' } })
  }
  const config = useRuntimeConfig()
  try {
    return jwt.verify(token, config.jwtSecret) as { role: string }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Token 无效或已过期',
      data: { error: 'Token 无效或已过期' },
    })
  }
}

export function hasAuthHeader(event: H3Event): boolean {
  return !!getHeader(event, 'authorization')
}

export function apiError(statusCode: number, message: string): never {
  throw createError({ statusCode, statusMessage: message, data: { error: message } })
}
