import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(to => {
  if (import.meta.server) return
  const auth = useAuthStore()
  if (!auth.isLoggedIn && to.path !== '/admin/login') {
    return navigateTo('/admin/login')
  }
})
