import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'light' | 'dark'>('dark')

  function apply() {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme.value)
    }
  }

  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  if (import.meta.client) {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') theme.value = saved
    apply()
    watch(theme, val => {
      localStorage.setItem('theme', val)
      apply()
    })
  }

  return { theme, toggle }
})
