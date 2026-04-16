import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const theme = ref(localStorage.getItem('theme') || 'light');

  function apply() {
    document.documentElement.setAttribute('data-theme', theme.value);
  }

  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  }

  watch(theme, val => {
    localStorage.setItem('theme', val);
    apply();
  });

  apply();

  return { theme, toggle };
});
