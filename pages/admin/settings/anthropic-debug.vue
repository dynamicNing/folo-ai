<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Anthropic Route Probe</div>
        <h1 class="page-title">代理调试</h1>
        <p class="page-sub">从服务端直接发起一次 Anthropic messages 请求，验证这条代理是否真能被当前系统使用。</p>
      </div>
      <NuxtLink to="/admin/settings/models" class="btn btn-ghost">返回设置</NuxtLink>
    </div>

    <div v-if="error && !result" class="notice notice-error">{{ error }}</div>

    <div class="grid">
      <section class="card panel">
        <div class="section-head">
          <div>
            <div class="section-title">网关快照</div>
            <div class="section-sub">这里展示的是当前服务端实际会使用的代理配置摘要。</div>
          </div>
          <span :class="['status-pill', effective?.api_key_configured ? 'enabled' : 'disabled']">
            {{ effective?.api_key_configured ? '已带密钥' : '未带密钥' }}
          </span>
        </div>

        <div class="kv-list">
          <div class="kv-row"><span class="kv-label">Source</span><span class="kv-value">{{ effectiveSourceLabel(effective?.source) }}</span></div>
          <div class="kv-row"><span class="kv-label">Label</span><span class="kv-value">{{ effective?.label || '—' }}</span></div>
          <div class="kv-row"><span class="kv-label">Base URL</span><span class="kv-value mono">{{ effective?.base_url || '—' }}</span></div>
          <div class="kv-row"><span class="kv-label">Endpoint</span><span class="kv-value mono">{{ expectedEndpoint }}</span></div>
          <div class="kv-row"><span class="kv-label">Auth</span><span class="kv-value mono">{{ effective?.auth_mode || '—' }}</span></div>
          <div class="kv-row"><span class="kv-label">Version</span><span class="kv-value mono">{{ effective?.anthropic_version || '—' }}</span></div>
          <div class="kv-row"><span class="kv-label">Default Model</span><span class="kv-value mono">{{ effective?.default_model || '—' }}</span></div>
          <div class="kv-row"><span class="kv-label">API Key</span><span class="kv-value mono">{{ effective?.api_key_preview || '未显示' }}</span></div>
        </div>

        <div class="notice notice-info compact">
          这个页面不在浏览器里直连第三方，而是复用你当前服务端的 Anthropic provider，因此更接近真实运行路径。
        </div>
      </section>

      <section class="card panel">
        <div class="section-head">
          <div>
            <div class="section-title">探测请求</div>
            <div class="section-sub">优先用短 prompt 验证协议兼容，再决定是否继续接真实业务 skill。</div>
          </div>
        </div>

        <form class="form" @submit.prevent="submit">
          <label class="field">
            <span class="field-label">模型</span>
            <input v-model.trim="form.model" class="input" :placeholder="effective?.default_model || 'claude-sonnet-4-20250514'" />
          </label>

          <label class="field">
            <span class="field-label">System</span>
            <textarea v-model="form.system" class="textarea" rows="3" placeholder="可选，留空即可" />
          </label>

          <label class="field">
            <span class="field-label">Prompt</span>
            <textarea
              v-model="form.prompt"
              class="textarea"
              rows="6"
              placeholder="Reply with exactly: ANTHROPIC_ROUTE_OK"
            />
          </label>

          <div class="field-grid">
            <label class="field">
              <span class="field-label">Temperature</span>
              <input v-model.number="form.temperature" class="input" type="number" min="0" max="1" step="0.1" />
            </label>
            <label class="field">
              <span class="field-label">Max Tokens</span>
              <input v-model.number="form.max_tokens" class="input" type="number" min="16" max="4096" step="1" />
            </label>
          </div>

          <div class="actions">
            <button class="btn btn-primary" :disabled="pending">
              {{ pending ? '探测中...' : '开始探测' }}
            </button>
            <button class="btn btn-ghost" type="button" :disabled="pending" @click="fillQuickProbe">
              一键填入标准探针
            </button>
          </div>
        </form>
      </section>
    </div>

    <section v-if="result" class="card panel result-panel">
      <div class="result-head">
        <div>
          <div class="section-title">探测结果</div>
          <div class="section-sub">先看状态和错误信息，再看输出内容是否符合预期。</div>
        </div>
        <span :class="['result-pill', result.ok ? 'ok' : 'fail']">
          {{ result.ok ? '可用' : '失败' }}
        </span>
      </div>

      <div class="result-grid">
        <div class="result-item">
          <div class="result-label">Endpoint</div>
          <div class="result-value mono">{{ result.endpoint }}</div>
        </div>
        <div class="result-item">
          <div class="result-label">Auth</div>
          <div class="result-value mono">{{ result.auth_mode }}</div>
        </div>
        <div class="result-item">
          <div class="result-label">Model</div>
          <div class="result-value mono">{{ result.model }}</div>
        </div>
        <div class="result-item">
          <div class="result-label">Latency</div>
          <div class="result-value">{{ formatDuration(result.duration_ms) }}</div>
        </div>
      </div>

      <div v-if="result.error" class="notice notice-error">{{ result.error }}</div>

      <div class="result-block">
        <div class="result-label">Output</div>
        <pre class="code-block">{{ result.output || '—' }}</pre>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  AnthropicGatewayEffectiveSettings,
  AnthropicGatewayDebugRequest,
  AnthropicGatewayDebugResponse,
} from '~/types/settings'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const api = useApi()
const loading = ref(false)
const pending = ref(false)
const error = ref('')
const effective = ref<AnthropicGatewayEffectiveSettings | null>(null)
const result = ref<AnthropicGatewayDebugResponse | null>(null)
const form = ref<Required<AnthropicGatewayDebugRequest>>({
  model: '',
  prompt: 'Reply with exactly: ANTHROPIC_ROUTE_OK',
  system: '',
  temperature: 0,
  max_tokens: 128,
})

const expectedEndpoint = computed(() => {
  const baseUrl = effective.value?.base_url?.trim() || ''
  if (!baseUrl) return '—'
  const clean = baseUrl.replace(/\/+$/, '')
  if (clean.endsWith('/messages')) return clean
  if (clean.endsWith('/v1')) return `${clean}/messages`
  return `${clean}/v1/messages`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.getModelSettings()
    effective.value = res.anthropic_effective
    if (!form.value.model) form.value.model = res.anthropic_effective.default_model
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function fillQuickProbe() {
  form.value.model = effective.value?.default_model || ''
  form.value.prompt = 'Reply with exactly: ANTHROPIC_ROUTE_OK'
  form.value.system = ''
  form.value.temperature = 0
  form.value.max_tokens = 128
}

async function submit() {
  pending.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.debugAnthropicGateway(form.value)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    pending.value = false
  }
}

function formatDuration(value: number): string {
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(2)} s`
}

function effectiveSourceLabel(source?: AnthropicGatewayEffectiveSettings['source']): string {
  return source === 'database' ? '数据库覆盖' : '环境变量 / 内置默认'
}

onMounted(load)
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; max-width: 1100px; }
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1.5px solid var(--border);
  padding-bottom: 1.25rem;
}
.eyebrow {
  font-family: var(--font-display);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}
.page-title { margin-top: 0.2rem; font-size: 1.45rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; max-width: 62ch; }

.grid { display: grid; grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: 1rem; }
.panel { padding: 1.25rem; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.section-title {
  font-family: var(--font-display);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.section-sub { margin-top: 0.3rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.5; }
.status-pill,
.result-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.68rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.status-pill.enabled,
.result-pill.ok { background: rgba(34, 197, 94, 0.12); color: #15803d; }
.status-pill.disabled,
.result-pill.fail { background: rgba(220, 38, 38, 0.1); color: #b91c1c; }

.kv-list { display: flex; flex-direction: column; gap: 0.75rem; }
.kv-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 0.8rem;
  align-items: flex-start;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid color-mix(in oklab, var(--border) 84%, transparent);
}
.kv-row:last-child { padding-bottom: 0; border-bottom: none; }
.kv-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.kv-value { color: var(--text); line-height: 1.55; overflow-wrap: anywhere; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.84rem; }

.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.field-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.input,
.textarea {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.82rem 0.9rem;
  font: inherit;
  outline: none;
}
.input:focus,
.textarea:focus { border-color: var(--accent); }
.textarea { resize: vertical; min-height: 110px; }

.actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.notice {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.notice.compact { margin-top: 1.1rem; }
.notice-info { color: var(--text-muted); background: var(--bg-raised); }
.notice-error { color: #b91c1c; background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.18); }

.result-panel { margin-top: 1rem; }
.result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.result-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}
.result-item {
  padding: 0.9rem;
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  border-radius: var(--radius);
  background: color-mix(in oklab, var(--bg-card) 82%, var(--accent-subtle));
}
.result-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.result-value { margin-top: 0.35rem; color: var(--text); line-height: 1.5; overflow-wrap: anywhere; }
.result-block { margin-top: 1rem; }
.code-block {
  margin: 0.55rem 0 0;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--bg-raised);
  border: 1px solid color-mix(in oklab, var(--border) 88%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  color: var(--text);
}

@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
  .result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 720px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head,
  .section-head,
  .result-head { flex-direction: column; align-items: flex-start; }
  .field-grid,
  .result-grid { grid-template-columns: 1fr; }
  .kv-row { grid-template-columns: 1fr; gap: 0.25rem; }
}
</style>
