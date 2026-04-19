import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

function getCookie(name: string): string {
  if (import.meta.server) return ''
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[()]/g, '\\$&') + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : ''
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')

  if (import.meta.client) {
    token.value = getCookie('auth_token') || localStorage.getItem('token') || ''
  }

  const isLoggedIn = computed(() => !!token.value)

  function setToken(t: string) {
    token.value = t
    if (import.meta.client) localStorage.setItem('token', t)
  }

  function logout() {
    token.value = ''
    if (import.meta.client) {
      localStorage.removeItem('token')
      document.cookie = 'auth_token=; Max-Age=0; path=/'
    }
  }

  function authHeader(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, isLoggedIn, setToken, logout, authHeader }
})
