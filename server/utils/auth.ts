import jwt from 'jsonwebtoken'
import { getCookie, type H3Event } from 'h3'

function getToken(event: H3Event): string | null {
  const header = getHeader(event, 'authorization') || ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  return getCookie(event, 'auth_token') || null
}

function verifyToken(token: string): { role: string } {
  const config = useRuntimeConfig()
  return jwt.verify(token, config.jwtSecret) as { role: string }
}

export function getAuthPayload(event: H3Event): { role: string } | null {
  const token = getToken(event)
  if (!token) return null
  try {
    return verifyToken(token)
  } catch {
    return null
  }
}

export function requireAuth(event: H3Event): { role: string } {
  const payload = getAuthPayload(event)
  if (!payload) {
    throw createError({ statusCode: 401, statusMessage: '未登录', data: { error: '未登录' } })
  }
  return payload
}

export function isAuthenticated(event: H3Event): boolean {
  return !!getAuthPayload(event)
}

export function apiError(statusCode: number, message: string): never {
  throw createError({ statusCode, statusMessage: message, data: { error: message } })
}
