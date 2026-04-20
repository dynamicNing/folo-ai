import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const isLoggedIn = ref(false)
  const hydrated = ref(false)
  const api = useApi()

  if (import.meta.client) {
    isLoggedIn.value = localStorage.getItem('admin_session_hint') === '1'
  }

  async function refreshSession() {
    if (import.meta.server) return
    try {
      const me = await api.getMe()
      isLoggedIn.value = me.authenticated
      if (me.authenticated) localStorage.setItem('admin_session_hint', '1')
      else localStorage.removeItem('admin_session_hint')
    } catch {
      isLoggedIn.value = false
      localStorage.removeItem('admin_session_hint')
    } finally {
      hydrated.value = true
    }
  }

  function markLoggedIn() {
    isLoggedIn.value = true
    if (import.meta.client) localStorage.setItem('admin_session_hint', '1')
  }

  async function logout() {
    try {
      await api.logout()
    } catch {
      // 即使服务端退出失败，也清理本地提示状态并跳登录页
    }
    isLoggedIn.value = false
    if (import.meta.client) {
      localStorage.removeItem('admin_session_hint')
      localStorage.removeItem('token')
    }
  }

  function authHeader(): Record<string, string> {
    return {}
  }

  return { isLoggedIn, hydrated, refreshSession, markLoggedIn, logout, authHeader }
})
