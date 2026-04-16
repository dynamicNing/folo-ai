import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const isLoggedIn = computed(() => !!token.value);

  function setToken(t) {
    token.value = t;
    localStorage.setItem('token', t);
  }

  function logout() {
    token.value = '';
    localStorage.removeItem('token');
  }

  function authHeader() {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  return { token, isLoggedIn, setToken, logout, authHeader };
});
