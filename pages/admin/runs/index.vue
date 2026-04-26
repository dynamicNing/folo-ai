<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Runs</h1>
        <p class="page-sub">这里只展示内置 skill 的运行历史、审批与结果；外部 skill 目前仍只做目录管理，不进入运行列表。</p>
      </div>
    </div>

    <div class="filter-bar card">
      <label class="filter">
        <span class="filter-label">Skill</span>
        <select v-model="filters.skill_slug" class="filter-select" @change="load">
          <option value="">全部</option>
          <option v-for="skill in skills" :key="skill.slug" :value="skill.slug">{{ skill.name }}</option>
        </select>
      </label>
      <label class="filter">
        <span class="filter-label">Provider</span>
        <select v-model="filters.provider" class="filter-select" @change="load">
          <option value="">全部</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>
      <label class="filter">
        <span class="filter-label">状态</span>
        <select v-model="filters.status" class="filter-select" @change="load">
          <option value="">全部</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="waiting_approval">Waiting Approval</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>
    <div v-else-if="!runs.length" class="empty card"><p>当前还没有运行记录。可以先从支持的 direct skill 开始运行，结果会出现在这里。</p></div>

    <template v-else>
      <!-- 批量操作栏 -->
      <div class="bulk-bar">
        <label class="check-all">
          <input type="checkbox" :checked="allChecked" :indeterminate="someChecked" @change="toggleAll" />
          <span>{{ selected.size > 0 ? `已选 ${selected.size} 条` : '全选' }}</span>
        </label>
        <button
          v-if="selected.size > 0"
          class="btn btn-export"
          :disabled="exporting"
          @click="exportSelected"
        >
          {{ exporting ? '导出中…' : `导出到 GitHub (${selected.size})` }}
        </button>
        <span v-if="exportResult" :class="['export-notice', exportResult.ok ? 'ok' : 'err']">
          {{ exportResult.text }}
        </span>
      </div>

      <div class="run-list">
        <div
          v-for="run in runs"
          :key="run.run_uid"
          class="run-row card"
          :class="{ 'run-selected': selected.has(run.run_uid) }"
        >
          <input
            type="checkbox"
            class="run-check"
            :checked="selected.has(run.run_uid)"
            @change="toggleRun(run.run_uid)"
            @click.stop
          />
          <NuxtLink :to="`/admin/runs/${run.run_uid}`" class="run-main">
            <div class="run-top">
              <div class="run-title">{{ run.skill_name || run.skill_slug }}</div>
              <span :class="`badge badge-${run.status}`">{{ statusLabel(run.status) }}</span>
            </div>
            <div class="run-meta">
              <span class="mono">{{ run.run_uid }}</span>
              <span>{{ providerLabel(run.provider) }}</span>
              <span>{{ engineLabel(run.engine_type) }}</span>
              <span class="mono">{{ run.model }}</span>
            </div>
            <div class="run-time">
              <span>创建于 {{ formatDate(run.created_at) }}</span>
              <span v-if="run.duration_ms != null">· {{ formatDuration(run.duration_ms) }}</span>
              <span v-if="run.error_message" class="fail">· {{ run.error_message }}</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import type { EngineType, Provider, RunStatus, SkillDefinitionSummary, SkillRunSummary } from '~/types/skill'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const api = useApi()
const auth = useAuthStore()
const loading = ref(false)
const error = ref('')
const runs = ref<SkillRunSummary[]>([])
const skills = ref<SkillDefinitionSummary[]>([])
const filters = ref<{
  skill_slug: string
  provider: Provider | ''
  status: RunStatus | ''
}>({
  skill_slug: '',
  provider: '',
  status: '',
})

const selected = reactive(new Set<string>())
const exporting = ref(false)
const exportResult = ref<{ ok: boolean; text: string } | null>(null)

const allChecked = computed(() => runs.value.length > 0 && runs.value.every(r => selected.has(r.run_uid)))
const someChecked = computed(() => runs.value.some(r => selected.has(r.run_uid)) && !allChecked.value)

async function load() {
  loading.value = true
  error.value = ''
  selected.clear()
  exportResult.value = null
  try {
    const [runRes, skillRes] = await Promise.all([
      api.getSkillRuns({ ...filters.value, pageSize: 50 }),
      api.getSkills({ source_origin: 'builtin' }),
    ])
    runs.value = runRes.data
    skills.value = skillRes.data
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function toggleRun(uid: string) {
  if (selected.has(uid)) selected.delete(uid)
  else selected.add(uid)
}

function toggleAll() {
  if (allChecked.value) {
    runs.value.forEach(r => selected.delete(r.run_uid))
  } else {
    runs.value.forEach(r => selected.add(r.run_uid))
  }
}

async function exportSelected() {
  if (!selected.size || exporting.value) return
  exporting.value = true
  exportResult.value = null
  try {
    const res = await $fetch<{ ok: boolean; exported: number; failed: number; errors: string[] }>(
      '/api/skill-runs/export',
      {
        method: 'POST',
        headers: auth.authHeader(),
        body: { runIds: [...selected] },
      }
    )
    exportResult.value = {
      ok: res.failed === 0,
      text: res.failed === 0
        ? `已成功导出 ${res.exported} 条到 GitHub content-archive/skill-runs/`
        : `导出完成：成功 ${res.exported} 条，失败 ${res.failed} 条`,
    }
  } catch (e) {
    exportResult.value = { ok: false, text: '导出失败：' + (e as Error).message }
  } finally {
    exporting.value = false
  }
}

function providerLabel(provider: Provider): string {
  return ({ openai: 'OpenAI', anthropic: 'Anthropic', external: 'External' } as const)[provider] || provider
}

function engineLabel(engine: EngineType): string {
  return ({ llm_direct: 'Direct', agent_sdk: 'Agent SDK', external: 'External' } as const)[engine] || engine
}

function statusLabel(status: RunStatus): string {
  return ({
    queued: 'Queued', running: 'Running', waiting_approval: 'Waiting Approval',
    succeeded: 'Succeeded', failed: 'Failed', cancelled: 'Cancelled',
  } as const)[status] || status
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`
}

onMounted(load)
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-head { margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; }

.filter-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; padding: 1rem 1.1rem; margin-bottom: 1rem; }
.filter { display: flex; flex-direction: column; gap: 0.4rem; }
.filter-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.filter-select { width: 100%; border: 1.5px solid var(--border-mid); border-radius: var(--radius); background: var(--bg-card); color: var(--text); padding: 0.75rem 0.85rem; font: inherit; }

.bulk-bar {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  padding: 0.6rem 0; margin-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.check-all { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-muted); cursor: pointer; }
.btn { padding: 0.4rem 0.9rem; border: none; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; font-family: var(--font-display); cursor: pointer; transition: all 0.15s; }
.btn-export { background: var(--accent); color: #fff; }
.btn-export:hover:not(:disabled) { opacity: 0.9; }
.btn-export:disabled { opacity: 0.5; cursor: not-allowed; }
.export-notice { font-size: 0.8rem; }
.export-notice.ok { color: #16a34a; }
.export-notice.err { color: #dc2626; }

.run-list { display: flex; flex-direction: column; gap: 0.85rem; }
.run-row { display: flex; align-items: center; gap: 0.85rem; padding: 1rem 1.1rem; transition: border-color 0.15s; }
.run-row:hover { border-color: var(--accent); }
.run-selected { background: var(--accent-subtle) !important; border-color: var(--accent) !important; }
.run-check { flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); }
.run-main { flex: 1; min-width: 0; text-decoration: none; color: inherit; }
.run-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.45rem; }
.run-title { font-size: 0.98rem; font-weight: 700; letter-spacing: -0.01em; }
.run-meta, .run-time { display: flex; gap: 0.55rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted); }
.run-time { margin-top: 0.35rem; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.fail { color: #b91c1c; }

.badge-queued { background: rgba(59,130,246,0.12); color: #2563eb; }
.badge-running { background: rgba(59,130,246,0.12); color: #2563eb; }
.badge-waiting_approval { background: rgba(234,179,8,0.14); color: #ca8a04; }
.badge-succeeded { background: rgba(34,197,94,0.12); color: #16a34a; }
.badge-failed { background: rgba(220,38,38,0.12); color: #dc2626; }
.badge-cancelled { background: rgba(107,114,128,0.14); color: #4b5563; }

.notice { margin-top: 1rem; padding: 0.9rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.notice-error { color: #b91c1c; background: rgba(220,38,38,0.06); border-color: rgba(220,38,38,0.18); }
.empty { padding: 2rem; text-align: center; color: var(--text-muted); }

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .filter-bar { grid-template-columns: 1fr; }
  .run-top { flex-direction: column; align-items: flex-start; }
}
</style>
