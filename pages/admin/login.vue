<template>
  <div class="login-wrap">
    <div class="login-box">
      <div class="login-brand">folo<span class="brand-accent">-</span>ai</div>
      <div class="login-sub">Follow One Step · 管理后台</div>

      <form class="login-form" @submit.prevent="submit">
        <div class="field">
          <label class="field-label">密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="输入管理员密码"
            autocomplete="current-password"
            class="field-input"
            :class="{ error: !!errorMsg }"
            required
          />
        </div>
        <div v-if="errorMsg" class="error-bar">{{ errorMsg }}</div>
        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner" style="width:14px;height:14px;border-width:2px" />
          {{ loading ? '验证中...' : '进入后台' }}
        </button>
      </form>

      <NuxtLink to="/" class="back-link">← 返回站点</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const router = useRouter()
const auth = useAuthStore()
const api = useApi()
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function submit() {
  errorMsg.value = ''
  loading.value = true
  try {
    const { token } = await api.login(password.value)
    auth.setToken(token)
    router.push('/admin')
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 1rem; }
.login-box { width: 100%; max-width: 360px; background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius); padding: 2.5rem 2rem; box-shadow: var(--shadow-md); }
.login-brand { font-family: var(--font-display); font-size: 2rem; font-weight: 700; letter-spacing: -0.04em; color: var(--text); margin-bottom: 0.25rem; }
.brand-accent { color: var(--accent); }
.login-sub { font-family: var(--font-display); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2rem; }
.login-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-family: var(--font-display); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
.field-input { padding: 0.65rem 0.9rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); color: var(--text); font-size: 0.95rem; font-family: var(--font-body); outline: none; transition: border-color 0.15s; }
.field-input:focus { border-color: var(--accent); }
.field-input.error { border-color: #dc2626; }
.error-bar { font-size: 0.82rem; color: #dc2626; padding: 0.5rem 0.75rem; background: rgba(220,38,38,0.07); border-radius: var(--radius-sm); border-left: 3px solid #dc2626; font-family: var(--font-display); font-weight: 500; }
.submit-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.7rem; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 0.875rem; font-weight: 700; font-family: var(--font-display); letter-spacing: 0.03em; cursor: pointer; transition: all 0.15s; }
.submit-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.back-link { display: block; text-align: center; margin-top: 1.5rem; font-size: 0.8rem; font-family: var(--font-display); font-weight: 600; letter-spacing: 0.03em; color: var(--text-muted); text-decoration: none; transition: color 0.15s; }
.back-link:hover { color: var(--accent); }
</style>
