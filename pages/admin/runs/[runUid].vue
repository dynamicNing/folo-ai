<template>
  <div class="page">
    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>

    <template v-else-if="run">
      <div class="page-head">
        <div>
          <div class="head-meta">
            <span class="tag">{{ providerLabel(run.provider) }}</span>
            <span class="tag">{{ engineLabel(run.engine_type) }}</span>
            <span :class="`badge badge-${run.status}`">{{ statusLabel(run.status) }}</span>
            <span class="tag">{{ streamStatusLabel }}</span>
          </div>
          <h1 class="page-title">{{ run.skill_name || run.skill_slug }}</h1>
          <p class="page-sub mono">{{ run.run_uid }}</p>
        </div>
        <NuxtLink to="/admin/runs" class="btn btn-ghost">返回列表</NuxtLink>
      </div>

      <div class="grid">
        <section class="card panel">
          <div class="section-title">运行摘要</div>
          <div class="kv-list">
            <div class="kv-row"><span class="kv-label">Skill Slug</span><span class="kv-value mono">{{ run.skill_slug }}</span></div>
            <div class="kv-row"><span class="kv-label">模型</span><span class="kv-value mono">{{ run.model }}</span></div>
            <div class="kv-row"><span class="kv-label">创建时间</span><span class="kv-value">{{ formatDate(run.created_at) }}</span></div>
            <div class="kv-row"><span class="kv-label">开始时间</span><span class="kv-value">{{ run.started_at ? formatDate(run.started_at) : '—' }}</span></div>
            <div class="kv-row"><span class="kv-label">结束时间</span><span class="kv-value">{{ run.finished_at ? formatDate(run.finished_at) : '—' }}</span></div>
            <div class="kv-row"><span class="kv-label">耗时</span><span class="kv-value">{{ run.duration_ms != null ? formatDuration(run.duration_ms) : '—' }}</span></div>
          </div>
          <div v-if="run.error_message" class="error-box">{{ run.error_message }}</div>
        </section>

        <section class="card panel">
          <div class="section-title">审批状态</div>
          <div v-if="!approvals.length" class="hint">当前没有审批请求。</div>
          <div v-else class="approval-list">
            <div v-for="approval in approvals" :key="approval.id" class="approval-row">
              <div class="approval-head">
                <div>
                  <div class="approval-title">{{ approval.human_message }}</div>
                  <div class="approval-meta">
                    <span class="tag">{{ approval.scope }}</span>
                    <span :class="`badge badge-approval-${approval.status}`">{{ approvalStatusLabel(approval.status) }}</span>
                  </div>
                </div>
                <div v-if="approval.status === 'pending' && run.status === 'waiting_approval'" class="approval-actions">
                  <button class="btn btn-primary" :disabled="approvalPending" @click="approve(approval.id)">批准</button>
                  <button class="btn btn-ghost btn-danger" :disabled="approvalPending" @click="reject(approval.id)">拒绝</button>
                </div>
              </div>
              <pre class="event-payload">{{ pretty(approval.payload) }}</pre>
            </div>
          </div>
          <div v-if="approvalError" class="notice notice-error">{{ approvalError }}</div>
        </section>
      </div>

      <section class="card panel" style="margin-top: 1rem;">
        <div class="section-title">执行进度</div>
        <div class="progress-headline">{{ progressHeadline }}</div>
        <div class="progress-list">
          <div v-for="step in progressSteps" :key="step.key" class="progress-row">
            <div :class="['progress-dot', `progress-dot-${step.status}`]" />
            <div class="progress-body">
              <div class="progress-top">
                <span class="progress-title">{{ step.title }}</span>
                <span :class="['progress-state', `progress-state-${step.status}`]">{{ progressStateLabel(step.status) }}</span>
              </div>
              <div class="progress-desc">{{ step.description }}</div>
            </div>
          </div>
        </div>
        <div v-if="failureHints.length" class="progress-hints">
          <div class="progress-hints-title">建议排查</div>
          <ul class="progress-hints-list">
            <li v-for="hint in failureHints" :key="hint">{{ hint }}</li>
          </ul>
        </div>
      </section>

      <div class="grid" style="margin-top: 1rem;">
        <section v-if="hasMetrics" class="card panel">
          <div class="section-title">资源统计</div>
          <div class="code-block-wrap">
            <pre class="code-block">{{ pretty(run.token_usage) }}</pre>
          </div>
          <div class="section-title" style="margin-top: 1rem;">成本快照</div>
          <div class="code-block-wrap">
            <pre class="code-block">{{ pretty(run.cost) }}</pre>
          </div>
        </section>

        <section :class="['card', 'panel', !hasMetrics ? 'full-span' : '']">
          <div class="section-title">Input</div>
          <pre class="code-block">{{ pretty(run.input) }}</pre>
        </section>
      </div>

      <section class="card panel" style="margin-top: 1rem;">
        <div class="section-title">Output</div>
        <pre class="code-block">{{ pretty(run.output) }}</pre>
      </section>

      <section class="card panel" style="margin-top: 1rem;">
        <div class="section-title">产物</div>
        <div v-if="!artifacts.length" class="hint">当前还没有产物记录。</div>
        <div v-else class="artifact-list">
          <div v-for="artifact in artifacts" :key="artifact.id" class="artifact-row">
            <div class="artifact-head">
              <div>
                <div class="artifact-title">{{ artifact.title }}</div>
                <div class="artifact-meta">
                  <span class="tag">{{ artifact.kind }}</span>
                  <span v-if="artifact.mime_type" class="tag">{{ artifact.mime_type }}</span>
                </div>
              </div>
              <span class="event-time">{{ formatDate(artifact.created_at) }}</span>
            </div>
            <pre v-if="artifact.content_text" class="event-payload">{{ artifact.content_text }}</pre>
          </div>
        </div>
      </section>

      <section class="card panel" style="margin-top: 1rem;">
        <div class="section-title">实时日志</div>
        <div v-if="!events.length" class="hint">当前还没有事件记录。</div>
        <div v-else class="event-list">
          <div v-for="item in events" :key="item.seq" class="event-row">
            <div class="event-head">
              <span class="event-type">{{ item.event_type }}</span>
              <span class="event-time">{{ formatDate(item.created_at) }}</span>
            </div>
            <pre class="event-payload">{{ pretty(item.payload) }}</pre>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ApprovalRequest, ApprovalStatus, Artifact, EngineType, Provider, RunStatus, SkillRunDetail, SkillRunEvent } from '~/types/skill'

definePageMeta({ layout: 'admin', middleware: 'auth' })

type ProgressStepStatus = 'done' | 'current' | 'pending' | 'failed'

interface ProgressStep {
  key: string
  title: string
  description: string
  status: ProgressStepStatus
}

const api = useApi()
const route = useRoute()
const loading = ref(false)
const error = ref('')
const run = ref<SkillRunDetail | null>(null)
const events = ref<SkillRunEvent[]>([])
const approvals = ref<ApprovalRequest[]>([])
const artifacts = ref<Artifact[]>([])
const streamState = ref<'idle' | 'connecting' | 'live' | 'closed' | 'error'>('idle')
const approvalPending = ref(false)
const approvalError = ref('')
let source: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

const streamStatusLabel = computed(() => ({
  idle: '日志待连接',
  connecting: '日志连接中',
  live: '日志实时中',
  closed: '日志已结束',
  error: '日志连接异常',
} as const)[streamState.value])

const hasMetrics = computed(() => {
  if (!run.value) return false
  return !isEmptyObject(run.value.token_usage) || !isEmptyObject(run.value.cost)
})
const eventMap = computed(() => {
  const map = new Map<string, SkillRunEvent>()
  for (const item of events.value) map.set(item.event_type, item)
  return map
})
const progressHeadline = computed(() => {
  if (!run.value) return ''
  return ({
    queued: '运行请求已创建，等待进入执行阶段。',
    running: '任务正在执行中，可结合下方阶段和原始事件流观察进度。',
    waiting_approval: '当前停在审批阶段，批准后会继续执行。',
    succeeded: '运行已完成，输出、产物和事件流都已落盘。',
    failed: '运行失败，建议先看失败阶段和原始日志。',
    cancelled: '运行已取消，可根据原因重新发起。',
  } as const)[run.value.status] || run.value.status
})
const progressSteps = computed<ProgressStep[]>(() => {
  if (!run.value) return []

  const steps: ProgressStep[] = [
    {
      key: 'created',
      title: '创建请求',
      description: 'Skill run 已写入数据库并准备进入执行链路。',
      status: hasEvent('run.created') ? 'done' : 'current',
    },
  ]

  const anyApprovalRejected = approvals.value.some(item => item.status === 'rejected')
  const anyApprovalApproved = approvals.value.some(item => item.status === 'approved')
  const needsApproval = approvals.value.length > 0 || hasEvent('approval.requested')
  if (needsApproval) {
    let approvalStatus: ProgressStepStatus = 'pending'
    if (anyApprovalRejected) approvalStatus = 'failed'
    else if (anyApprovalApproved || hasEvent('run.started')) approvalStatus = 'done'
    else if (run.value.status === 'waiting_approval') approvalStatus = 'current'

    const pendingScopes = approvals.value
      .filter(item => item.status === 'pending')
      .map(item => item.scope)
      .filter(Boolean)
    steps.push({
      key: 'approval',
      title: '等待审批',
      description: approvalStatus === 'failed'
        ? '审批被拒绝，运行不会继续。'
        : pendingScopes.length
          ? `待批准范围：${pendingScopes.join(' / ')}`
          : '该 skill 命中默认权限边界，批准后才会继续执行。',
      status: approvalStatus,
    })
  }

  if (run.value.engine_type === 'agent_sdk') {
    steps.push(
      buildPhaseStep(
        'research',
        '研究资料',
        'agent.research.started',
        'agent.research.completed',
        hasEvent('run.started'),
        event => {
          const combined = Number(event.payload.combined || 0)
          const articles = Number(event.payload.articles || 0)
          const socials = Number(event.payload.socials || 0)
          return `已汇总 ${combined} 条线索（文章 ${articles} / 社交 ${socials}）。`
        },
        '正在收集可用来源与研究线索。'
      ),
      buildPhaseStep(
        'plan',
        '规划结构',
        'agent.plan.started',
        'agent.plan.completed',
        hasEvent('agent.research.completed'),
        event => {
          const sections = Number(event.payload.sections || 0)
          const watchItems = Number(event.payload.watch_items || 0)
          return `已生成 ${sections} 个结构段落，附带 ${watchItems} 个跟踪项。`
        },
        '正在生成草稿结构与章节规划。'
      ),
      buildPhaseStep(
        'compose',
        '撰写输出',
        'agent.compose.started',
        'agent.compose.completed',
        hasEvent('agent.plan.completed'),
        event => `已产出约 ${Number(event.payload.chars || 0)} 个字符的 Markdown 草稿。`,
        '正在把规划转换成最终 Markdown 草稿。'
      ),
    )
  } else {
    steps.push(buildPhaseStep(
      'engine',
      '调用模型',
      'engine.started',
      'engine.completed',
      hasEvent('run.started'),
      event => `模型返回 ${Array.isArray(event.payload.keys) ? event.payload.keys.length : 0} 个输出字段。`,
      '正在把输入发送给当前 skill 对应的模型执行。'
    ))
  }

  steps.push({
    key: 'final',
    title: '完成落盘',
    description: run.value.status === 'succeeded'
      ? `运行完成${artifacts.value.length ? `，并生成 ${artifacts.value.length} 个产物。` : '，当前没有额外产物。'}`
      : run.value.status === 'failed'
        ? (run.value.error_message || '运行失败，请查看日志。')
        : run.value.status === 'cancelled'
          ? (run.value.error_message || '运行已取消。')
          : '等待执行链路完成并写入最终输出。',
    status: run.value.status === 'succeeded'
      ? 'done'
      : run.value.status === 'failed' || run.value.status === 'cancelled'
        ? 'failed'
        : hasEvent('engine.completed') || hasEvent('agent.compose.completed')
          ? 'current'
          : 'pending',
  })

  return steps
})
const failureHints = computed(() => {
  const message = run.value?.error_message?.trim() || ''
  if (!message) return []

  const hints: string[] = []
  if (message.includes('不能为空') || message.includes('Input JSON')) {
    hints.push('先检查示例参数是否仍缺少必填字段，尤其是标题、日期、topic 这类核心输入。')
  }
  if (message.includes('API error') || message.includes('401') || message.includes('403') || message.includes('quota') || message.includes('配额')) {
    hints.push('去模型设置页或 Anthropic 调试页确认 base URL、认证头、模型名和额度状态。')
  }
  if (message.includes('重启') || message.includes('中断')) {
    hints.push('这是可重试型错误；确认服务稳定后重新发起一次运行即可。')
  }
  if (!hints.length) {
    hints.push('先对照下方原始事件流和 error_message，区分是参数问题、审批阻塞还是模型路由异常。')
  }
  return hints
})

function isTerminal(status: RunStatus | undefined | null): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

function hasEvent(type: string): boolean {
  return eventMap.value.has(type)
}

function getEvent(type: string): SkillRunEvent | null {
  return eventMap.value.get(type) || null
}

function buildPhaseStep(
  key: string,
  title: string,
  startedEventType: string,
  completedEventType: string,
  eligible: boolean,
  completedDescription: (event: SkillRunEvent) => string,
  pendingDescription: string,
): ProgressStep {
  const completed = getEvent(completedEventType)
  const started = getEvent(startedEventType)

  let status: ProgressStepStatus = 'pending'
  if (completed) status = 'done'
  else if (run.value?.status === 'failed' || run.value?.status === 'cancelled') {
    status = started || eligible ? 'failed' : 'pending'
  } else if (started) {
    status = 'current'
  } else if (eligible) {
    status = 'pending'
  }

  const description = completed
    ? completedDescription(completed)
    : started
      ? pendingDescription
      : pendingDescription

  return { key, title, description, status }
}

function upsertEvents(items: SkillRunEvent[]) {
  if (!items.length) return
  const merged = new Map<number, SkillRunEvent>()
  for (const item of events.value) merged.set(item.seq, item)
  for (const item of items) merged.set(item.seq, item)
  events.value = Array.from(merged.values()).sort((a, b) => a.seq - b.seq)
}

async function refreshRun() {
  run.value = await api.getSkillRun(String(route.params.runUid || ''))
}

async function refreshApprovals() {
  approvals.value = (await api.getSkillRunApprovals(String(route.params.runUid || ''))).data
}

async function refreshArtifacts() {
  artifacts.value = (await api.getSkillRunArtifacts(String(route.params.runUid || ''))).data
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const runUid = String(route.params.runUid || '')
    const [runRes, eventRes, approvalRes, artifactRes] = await Promise.all([
      api.getSkillRun(runUid),
      api.getSkillRunEvents(runUid),
      api.getSkillRunApprovals(runUid),
      api.getSkillRunArtifacts(runUid),
    ])
    run.value = runRes
    events.value = eventRes.data
    approvals.value = approvalRes.data
    artifacts.value = artifactRes.data
    if (import.meta.client) connectStream()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function closeStream() {
  if (source) {
    source.close()
    source = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function connectStream() {
  if (!import.meta.client || !run.value || isTerminal(run.value.status) || source) {
    if (run.value && isTerminal(run.value.status)) streamState.value = 'closed'
    return
  }

  streamState.value = 'connecting'
  const since = events.value.length ? events.value[events.value.length - 1].seq : 0
  source = new EventSource(`/api/skill-runs/${run.value.run_uid}/stream?since=${since}`)

  source.addEventListener('skill-run-event', async (raw) => {
    streamState.value = 'live'
    const evt = JSON.parse((raw as MessageEvent).data) as SkillRunEvent
    upsertEvents([evt])

    if (evt.event_type === 'run.started' || evt.event_type === 'run.completed' || evt.event_type === 'run.failed' || evt.event_type === 'run.cancelled') {
      await refreshRun()
    }
    if (evt.event_type.startsWith('approval.')) {
      await Promise.all([refreshRun(), refreshApprovals()])
    }
    if (evt.event_type === 'artifact.created' || evt.event_type === 'run.completed') {
      await refreshArtifacts()
    }
    if (evt.event_type === 'run.completed' || evt.event_type === 'run.failed' || evt.event_type === 'run.cancelled') {
      streamState.value = 'closed'
      closeStream()
    }
  })

  source.addEventListener('stream.end', async () => {
    await refreshRun()
    streamState.value = 'closed'
    closeStream()
  })

  source.onerror = () => {
    closeStream()
    if (run.value && !isTerminal(run.value.status)) {
      streamState.value = 'error'
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectStream()
      }, 1500)
    } else {
      streamState.value = 'closed'
    }
  }
}

async function approve(id: number) {
  if (!run.value) return
  approvalPending.value = true
  approvalError.value = ''
  try {
    const res = await api.approveSkillRunApproval(run.value.run_uid, id)
    run.value = res.run
    await refreshApprovals()
  } catch (err) {
    approvalError.value = (err as Error).message
  } finally {
    approvalPending.value = false
  }
}

async function reject(id: number) {
  if (!run.value) return
  approvalPending.value = true
  approvalError.value = ''
  try {
    const res = await api.rejectSkillRunApproval(run.value.run_uid, id)
    run.value = res.run
    await refreshApprovals()
  } catch (err) {
    approvalError.value = (err as Error).message
  } finally {
    approvalPending.value = false
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
    queued: 'Queued',
    running: 'Running',
    waiting_approval: 'Waiting Approval',
    succeeded: 'Succeeded',
    failed: 'Failed',
    cancelled: 'Cancelled',
  } as const)[status] || status
}

function progressStateLabel(status: ProgressStepStatus): string {
  return ({
    done: '已完成',
    current: '进行中',
    pending: '待开始',
    failed: '失败',
  } as const)[status] || status
}

function approvalStatusLabel(status: ApprovalStatus): string {
  return ({
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
  } as const)[status] || status
}

function pretty(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}

function isEmptyObject(value: Record<string, unknown>): boolean {
  return !value || Object.keys(value).length === 0
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
onBeforeUnmount(closeStream)
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.head-meta { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.7rem; }
.page-title { font-size: 1.45rem; font-weight: 700; letter-spacing: -0.03em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.88rem; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.full-span { grid-column: 1 / -1; }
.panel { padding: 1.15rem; }
.section-title { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.9rem; }
.kv-list { display: flex; flex-direction: column; gap: 0.7rem; }
.kv-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 0.7rem; border-bottom: 1px solid var(--border); }
.kv-row:last-child { border-bottom: none; padding-bottom: 0; }
.kv-label { color: var(--text-muted); font-size: 0.84rem; }
.kv-value { text-align: right; font-size: 0.86rem; font-weight: 600; }
.approval-list { display: flex; flex-direction: column; gap: 0.8rem; }
.approval-row { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--bg-card); }
.approval-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid var(--border);
}
.approval-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 0.45rem; }
.approval-meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.approval-actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.btn-danger { color: #b91c1c; border-color: rgba(220,38,38,0.24); }
.btn-danger:hover { background: rgba(220,38,38,0.08); color: #b91c1c; }
.error-box {
  margin-top: 1rem;
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius);
  background: rgba(220,38,38,0.06);
  border: 1px solid rgba(220,38,38,0.18);
  color: #b91c1c;
  font-size: 0.84rem;
}
.code-block {
  margin: 0;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  overflow: auto;
  font-size: 0.76rem;
  line-height: 1.55;
}

.progress-headline {
  margin-bottom: 1rem;
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.6;
}
.progress-list { display: flex; flex-direction: column; gap: 0.9rem; }
.progress-row { display: flex; align-items: flex-start; gap: 0.85rem; }
.progress-dot {
  width: 11px;
  height: 11px;
  margin-top: 0.35rem;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--border);
}
.progress-dot-done { background: #16a34a; }
.progress-dot-current { background: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12); }
.progress-dot-pending { background: #94a3b8; }
.progress-dot-failed { background: #dc2626; }
.progress-body {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.85rem 0.95rem;
  background: var(--bg-card);
}
.progress-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.progress-title { font-size: 0.88rem; font-weight: 700; }
.progress-state { font-size: 0.76rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
.progress-state-done { color: #16a34a; }
.progress-state-current { color: #2563eb; }
.progress-state-pending { color: #64748b; }
.progress-state-failed { color: #dc2626; }
.progress-desc { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.82rem; line-height: 1.6; }
.progress-hints {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
.progress-hints-title { margin-bottom: 0.45rem; font-size: 0.84rem; font-weight: 700; color: var(--text); }
.progress-hints-list { margin: 0; padding-left: 1.1rem; color: var(--text-muted); font-size: 0.82rem; line-height: 1.7; }

.event-list { display: flex; flex-direction: column; gap: 0.8rem; }
.event-row { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); overflow: hidden; }
.event-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-raised);
}
.event-type { font-family: var(--font-display); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); }
.event-time { color: var(--text-muted); font-size: 0.76rem; }
.event-payload {
  margin: 0;
  padding: 0.85rem 0.95rem;
  overflow: auto;
  font-size: 0.75rem;
  line-height: 1.55;
  background: var(--bg-card);
}

.notice { margin-top: 1rem; padding: 0.9rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.notice-error { color: #b91c1c; background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.18); }
.badge-queued { background: rgba(59,130,246,0.12); color: #2563eb; }
.badge-running { background: rgba(59,130,246,0.12); color: #2563eb; }
.badge-waiting_approval { background: rgba(234,179,8,0.14); color: #ca8a04; }
.badge-succeeded { background: rgba(34,197,94,0.12); color: #16a34a; }
.badge-failed { background: rgba(220,38,38,0.12); color: #dc2626; }
.badge-cancelled { background: rgba(107,114,128,0.14); color: #4b5563; }
.badge-approval-pending { background: rgba(234,179,8,0.14); color: #ca8a04; }
.badge-approval-approved { background: rgba(34,197,94,0.12); color: #16a34a; }
.badge-approval-rejected { background: rgba(220,38,38,0.12); color: #dc2626; }

@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head { flex-direction: column; }
  .kv-row { flex-direction: column; }
  .kv-value { text-align: left; }
  .approval-head { flex-direction: column; }
  .progress-top { flex-direction: column; align-items: flex-start; }
}
</style>
