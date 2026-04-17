import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')

  if (import.meta.client) {
    token.value = localStorage.getItem('token') || ''
  }

  const isLoggedIn = computed(() => !!token.value)

  function setToken(t: string) {
    token.value = t
    if (import.meta.client) localStorage.setItem('token', t)
  }

  function logout() {
    token.value = ''
    if (import.meta.client) localStorage.removeItem('token')
  }

  function authHeader(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, isLoggedIn, setToken, logout, authHeader }
})
