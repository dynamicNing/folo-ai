import { getCookie } from 'h3'

export default defineNuxtRouteMiddleware(async to => {
  // 登录页本身放行
  if (to.path === '/admin/login') return

  // 客户端：仅做一次后端会话校准，避免 SSR/CSR 状态源不一致。
  if (import.meta.client) {
    const auth = useAuthStore()
    if (!auth.hydrated) {
      return auth.refreshSession().then(() => {
        if (!auth.isLoggedIn) navigateTo('/admin/login')
      })
    }
    if (!auth.isLoggedIn) return navigateTo('/admin/login')
    return
  }

  // 服务端：从 cookie 读取并验证 token
  const event = useRequestEvent()
  if (!event) return navigateTo('/admin/login')
  const token = getCookie(event, 'auth_token')
  if (!token) return navigateTo('/admin/login')
  try {
    const config = useRuntimeConfig()
    const jwt = await import('jsonwebtoken')
    jwt.verify(token, config.jwtSecret)
  } catch {
    return navigateTo('/admin/login')
  }
})
