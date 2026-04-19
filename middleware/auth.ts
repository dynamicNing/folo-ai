import jwt from 'jsonwebtoken'
import { getCookie } from 'h3'

export default defineNuxtRouteMiddleware(to => {
  // 登录页本身放行
  if (to.path === '/admin/login') return

  if (import.meta.server) {
    // 服务端：从 cookie 读取并验证 token
    const event = useRequestEvent()
    if (!event) return navigateTo('/admin/login')
    const token = getCookie(event, 'auth_token')
    if (!token) return navigateTo('/admin/login')
    try {
      const config = useRuntimeConfig()
      jwt.verify(token, config.jwtSecret)
    } catch {
      return navigateTo('/admin/login')
    }
  } else {
    // 客户端：检查 localStorage token（向后兼容）
    const auth = useAuthStore()
    if (!auth.isLoggedIn) return navigateTo('/admin/login')
  }
})
