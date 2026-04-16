<template>
  <div class="login-page">
    <div class="login-card card">
      <div class="login-header">
        <div class="login-logo">folo-ai</div>
        <p class="text-muted text-sm">管理后台</p>
      </div>
      <form @submit.prevent="submit">
        <div class="field">
          <label>密码</label>
          <input
            v-model="password"
            type="password"
            placeholder="输入管理员密码"
            autocomplete="current-password"
            required
          />
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <button type="submit" class="btn btn-primary w-full" :disabled="loading">
          <span v-if="loading" class="spinner" style="width:14px;height:14px;border-width:2px" />
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
      <div class="login-footer">
        <RouterLink to="/" class="text-muted text-sm">← 返回站点</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api';

const router = useRouter();
const auth = useAuthStore();
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const { token } = await api.login(password.value);
    auth.setToken(token);
    router.push('/admin');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 1rem;
}
.login-card { width: 100%; max-width: 380px; padding: 2rem; }
.login-header { text-align: center; margin-bottom: 1.75rem; }
.login-logo {
  font-size: 1.8rem;
  font-weight: 700;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.25rem;
}
.field { margin-bottom: 1rem; }
.field label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.4rem; }
.field input {
  width: 100%;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
}
.field input:focus { border-color: var(--accent); }
.error-msg {
  font-size: 0.85rem;
  color: #dc3545;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(220,53,69,0.08);
  border-radius: var(--radius);
}
.w-full { width: 100%; justify-content: center; padding-top: 0.6rem; padding-bottom: 0.6rem; }
.login-footer { margin-top: 1.5rem; text-align: center; }
</style>
