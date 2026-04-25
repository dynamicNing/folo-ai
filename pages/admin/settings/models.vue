<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-sub">配置 Anthropic 官方或代理站网关。开启数据库覆盖时服务端优先使用这里的值，停用时回退到环境变量或内置默认。</p>
      </div>
      <NuxtLink to="/admin/settings/anthropic-debug" class="btn btn-ghost">调试代理</NuxtLink>
    </div>

    <div class="panel card">
      <div class="section-head">
        <div>
          <div class="section-title">Anthropic Route</div>
          <div class="section-sub">兼容官方 `messages` 路线，也兼容需要 `Bearer` 认证的代理站。</div>
        </div>
        <span :class="['status-pill', form.enabled ? 'enabled' : 'disabled']">{{ form.enabled ? '数据库覆盖已启用' : '数据库覆盖已停用' }}</span>
      </div>

      <form class="form" @submit.prevent="submit">
        <label class="toggle-row">
          <span>
            <span class="field-label">启用数据库配置覆盖</span>
            <span class="field-hint">开启后，Anthropic provider 会优先使用这里保存的网关、模型和密钥；关闭后仅保留这些值，不参与实际调用。</span>
          </span>
          <input v-model="form.enabled" type="checkbox" class="toggle" />
        </label>

        <div class="effective-panel">
          <div class="field-label">当前服务端实际生效</div>
          <div class="effective-grid">
            <div class="effective-item">
              <span class="effective-name">来源</span>
              <span class="effective-value">{{ effectiveSourceLabel(effective?.source) }}</span>
            </div>
            <div class="effective-item">
              <span class="effective-name">模型</span>
              <span class="effective-value mono">{{ effective?.default_model || '—' }}</span>
            </div>
            <div class="effective-item full">
              <span class="effective-name">Base URL</span>
              <span class="effective-value mono">{{ effective?.base_url || '—' }}</span>
            </div>
            <div class="effective-item">
              <span class="effective-name">认证</span>
              <span class="effective-value mono">{{ effective?.auth_mode || '—' }}</span>
            </div>
            <div class="effective-item">
              <span class="effective-name">API Key</span>
              <span class="effective-value mono">{{ effective?.api_key_preview || '未配置' }}</span>
            </div>
          </div>
        </div>

        <div v-if="!form.enabled" class="notice notice-info compact">
          当前已停用数据库覆盖。下面填写的配置会继续保留，但真实运行会回退到环境变量或内置默认代理。
        </div>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">路由名称</span>
            <input v-model.trim="form.label" class="input" placeholder="Anthropic Route" />
          </label>
          <label class="field">
            <span class="field-label">默认模型</span>
            <input v-model.trim="form.default_model" class="input" placeholder="claude-sonnet-4-20250514" />
          </label>
        </div>

        <label class="field">
          <span class="field-label">Base URL</span>
          <input v-model.trim="form.base_url" class="input" placeholder="https://api.anthropic.com 或 https://proxy.example.com/v1" />
          <span class="field-hint">可填写根域名、`/v1` 或完整 `/v1/messages`。服务端会自动补全 endpoint。</span>
        </label>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">认证模式</span>
            <select v-model="form.auth_mode" class="input">
              <option value="x_api_key">x-api-key</option>
              <option value="bearer">Bearer</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Anthropic Version</span>
            <input v-model.trim="form.anthropic_version" class="input" placeholder="2023-06-01" />
          </label>
        </div>

        <label class="field">
          <span class="field-label">API Key</span>
          <input v-model.trim="form.api_key" class="input" type="password" placeholder="留空表示保持当前密钥" />
          <span class="field-hint">
            数据库存储：
            <template v-if="settings?.api_key_configured">已保存 {{ settings.api_key_preview }}</template>
            <template v-else>未保存</template>
          </span>
        </label>

        <label class="toggle-row subtle">
          <span>
            <span class="field-label">清空已保存的 API Key</span>
            <span class="field-hint">保存时会删除数据库中的 Anthropic key。若已停用数据库覆盖，实际调用本来就会走环境变量或内置默认。</span>
          </span>
          <input v-model="form.clear_api_key" type="checkbox" class="toggle" />
        </label>

        <div class="notice notice-info">
          当前实现会把 API Key 存在服务端 SQLite 中，浏览器不会直接持有密钥，但该密钥目前未做额外加密。
        </div>

        <div class="actions">
          <button class="btn btn-primary" :disabled="saving">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
          <span v-if="savedText" class="success-text">{{ savedText }}</span>
        </div>
      </form>
    </div>

    <div v-if="error" class="notice notice-error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type {
  AnthropicGatewayEffectiveSettings,
  AnthropicGatewaySettings,
  AnthropicGatewayUpdateRequest,
} from '~/types/settings'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const api = useApi()
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const savedText = ref('')
const settings = ref<AnthropicGatewaySettings | null>(null)
const effective = ref<AnthropicGatewayEffectiveSettings | null>(null)
const form = ref<AnthropicGatewayUpdateRequest>({
  enabled: false,
  label: 'Anthropic Route',
  base_url: 'https://api.anthropic.com',
  default_model: 'claude-sonnet-4-20250514',
  auth_mode: 'x_api_key',
  anthropic_version: '2023-06-01',
  api_key: '',
  clear_api_key: false,
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.getModelSettings()
    settings.value = res.anthropic
    effective.value = res.anthropic_effective
    form.value = {
      enabled: res.anthropic.enabled,
      label: res.anthropic.label,
      base_url: res.anthropic.base_url,
      default_model: res.anthropic.default_model,
      auth_mode: res.anthropic.auth_mode,
      anthropic_version: res.anthropic.anthropic_version,
      api_key: '',
      clear_api_key: false,
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function submit() {
  saving.value = true
  error.value = ''
  savedText.value = ''
  try {
    const res = await api.updateAnthropicSettings(form.value)
    settings.value = res.anthropic
    effective.value = res.anthropic_effective
    form.value.api_key = ''
    form.value.clear_api_key = false
    savedText.value = '配置已保存'
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    saving.value = false
  }
}

function effectiveSourceLabel(source?: AnthropicGatewayEffectiveSettings['source']): string {
  return source === 'database' ? '数据库覆盖' : '环境变量 / 内置默认'
}

onMounted(load)
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; max-width: 980px; }
.page-head { margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; }

.panel { padding: 1.25rem; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.2rem; }
.section-title { font-family: var(--font-display); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.section-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.84rem; }
.status-pill { display: inline-flex; align-items: center; padding: 0.28rem 0.65rem; border-radius: var(--radius-sm); font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.status-pill.enabled { background: rgba(34,197,94,0.12); color: #16a34a; }
.status-pill.disabled { background: rgba(107,114,128,0.14); color: #4b5563; }

.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.field-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); display: block; }
.field-hint { margin-top: 0.2rem; color: var(--text-muted); font-size: 0.8rem; line-height: 1.5; display: block; }
.effective-panel {
  padding: 0.95rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-raised);
}
.effective-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 0.75rem;
}
.effective-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.effective-item.full { grid-column: 1 / -1; }
.effective-name {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.effective-value { color: var(--text); line-height: 1.5; overflow-wrap: anywhere; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84rem; }
.input {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.8rem 0.9rem;
  font: inherit;
  outline: none;
}
.input:focus { border-color: var(--accent); }

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-raised);
}
.toggle-row.subtle { background: var(--bg-card); }
.toggle {
  width: 20px;
  height: 20px;
  accent-color: var(--accent);
  flex-shrink: 0;
}

.actions { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; }
.success-text { color: #16a34a; font-size: 0.85rem; font-weight: 600; }
.notice { margin-top: 1rem; padding: 0.9rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.notice.compact { margin-top: 0; }
.notice-info { color: var(--text-muted); background: var(--bg-raised); }
.notice-error { color: #b91c1c; background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.18); }

@media (max-width: 720px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .field-grid, .effective-grid { grid-template-columns: 1fr; }
  .toggle-row, .section-head { flex-direction: column; align-items: flex-start; }
}
</style>
