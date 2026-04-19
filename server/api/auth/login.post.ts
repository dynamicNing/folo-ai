import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { apiError } from '~/server/utils/auth'

export default defineEventHandler(async event => {
  const body = await readBody<{ password?: string }>(event)
  if (!body?.password) apiError(400, '请输入密码')

  const config = useRuntimeConfig()
  if (!config.adminPasswordHash) apiError(500, '服务端未配置管理员密码')

  const ok = await bcrypt.compare(body.password, config.adminPasswordHash)
  if (!ok) apiError(401, '密码错误')

  const token = jwt.sign({ role: 'admin' }, config.jwtSecret, { expiresIn: '7d' })

  // 设置 httpOnly cookie，7天有效
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7天
    path: '/',
  })

  return { token }
})
