export default defineEventHandler(event => {
  // httpOnly cookie 只能由服务端清理
  setCookie(event, 'auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return { ok: true as const }
})
