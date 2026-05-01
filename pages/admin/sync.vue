<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">内容同步</h1>
        <p class="page-sub">从 GitHub content-archive 仓库同步 Markdown 文章到数据库</p>
      </div>
      <button class="btn-sync" :disabled="running" @click="runSync">
        <svg v-if="!running" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        <span v-else class="spinner-sm" />
        {{ running ? '同步中…' : '立即全量同步' }}
      </button>
    </div>

    <div v-if="lastResult" class="banner" :class="`banner-${lastResult.kind}`">
      {{ lastResult.text }}
    </div>

    <div class="section" style="margin-top: 1.5rem;">
      <div class="section-head">
        <span>同步记录</span>
        <button class="refresh-btn" :disabled="loading" @click="load">刷新</button>
      </div>

      <div v-if="loading && !logs.length" class="loading"><div class="spinner" />加载中...</div>
      <div v-else-if="!logs.length" class="empty"><p>暂无同步记录</p></div>

      <div v-else class="log-list">
        <div v-for="log in logs" :key="log.id" class="log-row">
          <div class="log-main">
            <div class="log-meta">
              <span :class="`badge badge-${log.status}`">{{ statusLabel(log.status) }}</span>
              <span class="tag">{{ sourceLabel(log.source) }}</span>
              <span class="text-muted text-sm">{{ formatTime(log.started_at) }}</span>
              <span v-if="log.duration_ms != null" class="text-muted text-sm">· {{ formatDuration(log.duration_ms) }}</span>
            </div>
            <div class="log-stats">
              <template v-if="log.source === 'webhook'">
                <span>+{{ log.added }}</span><span>~{{ log.modified }}</span><span>-{{ log.removed }}</span>
                <span class="sep">·</span>
                <span>处理 {{ log.processed }}</span>
                <span v-if="log.failed > 0" class="fail">失败 {{ log.failed }}</span>
              </template>
              <template v-else>
                <span>共 {{ log.total }}</span>
                <span class="sep">·</span>
                <span>处理 {{ log.processed }}</span>
                <span v-if="log.failed > 0" class="fail">失败 {{ log.failed }}</span>
              </template>
            </div>
            <div v-if="log.message" class="log-msg">{{ log.message }}</div>
          </div>
          <button v-if="hasErrors(log)" class="detail-btn" @click="toggle(log.id)">
            {{ expanded.has(log.id) ? '收起' : '错误详情' }}
          </button>
        </div>
        <div v-for="log in logs" :key="`d-${log.id}`">
          <pre v-if="expanded.has(log.id) && hasErrors(log)" class="detail-pre">{{ formatDetail(log.detail) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { SyncLog, SyncLogStatus, SyncSource } from '~/types/article'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const api = useApi()
const auth = useAuthStore()

const logs = ref<SyncLog[]>([])
const loading = ref(false)
const running = ref(false)
const lastResult = ref<{ kind: 'success' | 'error' | 'partial'; text: string } | null>(null)
const expanded = reactive(new Set<number>())

async function load() {
  loading.value = true
  try {
    const res = await api.getSyncLogs(auth.authHeader())
    logs.value = res.data
  } catch (e) {
    lastResult.value = { kind: 'error', text: '加载记录失败：' + (e as Error).message }
  } finally {
    loading.value = false
  }
}

async function runSync() {
  if (running.value) return
  running.value = true
  lastResult.value = null
  try {
    const res = await api.runSyncAll(auth.authHeader())
    const kind = res.failed > 0 ? 'partial' : 'success'
    lastResult.value = {
      kind,
      text: `同步完成：共 ${res.total} 篇，处理 ${res.processed}${res.failed > 0 ? `，失败 ${res.failed}` : ''}`,
    }
    await load()
  } catch (e) {
    lastResult.value = { kind: 'error', text: '同步失败：' + (e as Error).message }
  } finally {
    running.value = false
  }
}

function toggle(id: number) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
}

function hasErrors(log: SyncLog): boolean {
  if (!log.detail) return false
  try {
    const d = JSON.parse(log.detail) as { errors?: unknown[] }
    return Array.isArray(d.errors) && d.errors.length > 0
  } catch { return false }
}

function formatDetail(detail: string | null): string {
  if (!detail) return ''
  try { return JSON.stringify(JSON.parse(detail), null, 2) }
  catch { return detail }
}

function statusLabel(s: SyncLogStatus): string {
  return ({ success: '成功', failed: '失败', partial: '部分成功', running: '进行中' } as const)[s] || s
}

function sourceLabel(s: SyncSource): string {
  return ({ manual: '手动', webhook: 'Webhook', cli: 'CLI' } as const)[s] || s
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { hour12: false })
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
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem; }

.btn-sync { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.55rem 1rem; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; font-family: var(--font-display); cursor: pointer; letter-spacing: 0.02em; transition: opacity 0.15s; }
.btn-sync:hover:not(:disabled) { opacity: 0.9; }
.btn-sync:disabled { opacity: 0.55; cursor: not-allowed; }

.banner { padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem; font-size: 0.85rem; border: 1px solid; }
.banner-success { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.3); color: #16a34a; }
.banner-partial { background: rgba(234,179,8,0.08); border-color: rgba(234,179,8,0.3); color: #ca8a04; }
.banner-error { background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.3); color: #dc2626; }

.section-head { display: flex; align-items: center; justify-content: space-between; font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; }
.refresh-btn { background: none; border: 1px solid var(--border); padding: 0.25rem 0.65rem; border-radius: var(--radius-sm); color: var(--text-muted); font-size: 0.7rem; cursor: pointer; letter-spacing: 0.05em; }
.refresh-btn:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }

.log-list { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); overflow: hidden; }
.log-row { display: flex; align-items: flex-start; gap: 1rem; padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--border); }
.log-row:last-child { border-bottom: none; }
.log-main { flex: 1; min-width: 0; }
.log-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
.log-stats { font-size: 0.82rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; color: var(--text); }
.log-stats .sep { color: var(--text-muted); }
.log-stats .fail { color: #dc2626; font-weight: 600; }
.log-msg { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem; }
.detail-btn { background: none; border: 1px solid var(--border); padding: 0.3rem 0.6rem; border-radius: var(--radius-sm); color: var(--text-muted); font-size: 0.72rem; cursor: pointer; flex-shrink: 0; }
.detail-btn:hover { color: var(--text); }
.detail-pre { background: var(--bg-raised); padding: 0.85rem 1rem; margin: 0; font-size: 0.72rem; line-height: 1.5; max-height: 280px; overflow: auto; border-bottom: 1px solid var(--border); white-space: pre-wrap; word-break: break-all; }

.badge-success { background: rgba(34,197,94,0.12); color: #16a34a; }
.badge-failed { background: rgba(220,38,38,0.12); color: #dc2626; }
.badge-partial { background: rgba(234,179,8,0.12); color: #ca8a04; }
.badge-running { background: rgba(59,130,246,0.12); color: #2563eb; }

.spinner-sm { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head { flex-direction: column; align-items: stretch; }
  .btn-sync { justify-content: center; }
}
</style>
