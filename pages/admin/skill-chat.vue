<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Skill Chat</h1>
        <p class="page-sub">先匹配内置 skill，再确认参数，再走现有 run / approval / SSE。当前会话会自动保存在服务端，刷新后会恢复，并支持跨浏览器 / 跨设备同步。</p>
      </div>
      <NuxtLink to="/admin/skills" class="btn btn-ghost">查看 Skills</NuxtLink>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>

    <template v-else>
      <section class="card support-card">
        <div class="support-head">
          <div>
            <div class="section-title">当前支持</div>
            <p class="support-sub">Chat MVP 只会建议调用当前可运行的内置 skill，不会直接执行外部 skill。</p>
          </div>
          <div class="support-tags">
            <span v-for="skill in builtinSkills" :key="skill.slug" class="tag">{{ skill.name }}</span>
          </div>
        </div>
      </section>

      <div class="chat-shell">
        <aside class="card session-panel">
          <div class="session-panel-head">
            <div>
              <div class="section-title">会话</div>
              <p class="session-sub">保存在服务端，会跨浏览器 / 跨设备同步。</p>
            </div>
            <button class="btn btn-primary btn-sm" type="button" @click="createNewSession">新建</button>
          </div>
          <div v-if="sessionError" class="notice notice-error session-error">{{ sessionError }}</div>

          <div class="session-list">
            <div
              v-for="session in sessionSummaries"
              :key="session.id"
              :class="['session-item', session.id === currentSessionId ? 'session-item-active' : '']"
              role="button"
              tabindex="0"
              @click="switchSession(session.id)"
              @keydown.enter.prevent="switchSession(session.id)"
              @keydown.space.prevent="switchSession(session.id)"
            >
              <div class="session-item-top">
                <div class="session-title">{{ session.title }}</div>
                <button
                  class="session-delete"
                  type="button"
                  title="删除会话"
                  @click.stop="deleteSession(session.id)"
                >
                  ×
                </button>
              </div>
              <div class="session-preview">{{ session.preview }}</div>
              <div class="session-meta">
                <span>{{ session.messageCount }} 条消息</span>
                <span>{{ formatSessionTime(session.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </aside>

        <section ref="messageViewport" class="card chat-panel">
          <template v-if="messages.length">
            <div v-for="message in messages" :key="message.id" class="message-wrap" :class="`message-wrap-${message.role}`">
              <template v-if="message.kind === 'text'">
                <div class="bubble" :class="`bubble-${message.role}`">
                  <div class="bubble-role">{{ message.role === 'user' ? '你' : 'Assistant' }}</div>
                  <div class="bubble-text">{{ message.text }}</div>
                </div>
              </template>

              <template v-else-if="message.kind === 'proposal'">
                <div class="card proposal-card">
                  <div class="proposal-top">
                    <div>
                      <div class="proposal-label">建议调用</div>
                      <div class="proposal-title">{{ message.skill.name }}</div>
                      <p class="proposal-desc">{{ message.skill.description }}</p>
                    </div>
                    <span :class="['confidence-pill', `confidence-pill-${message.confidence}`]">{{ confidenceLabel(message.confidence) }}</span>
                  </div>

                  <div v-if="message.reasons.length" class="proposal-meta">
                    <span class="proposal-meta-label">匹配依据</span>
                    <div class="tag-row">
                      <span v-for="reason in message.reasons" :key="reason" class="tag">{{ reason }}</span>
                    </div>
                  </div>

                  <div class="proposal-meta">
                    <span class="proposal-meta-label">用户输入</span>
                    <p class="proposal-input">{{ message.userText }}</p>
                  </div>

                  <div class="proposal-fields">
                    <label v-for="field in message.fields" :key="field.key" :class="['field', field.multiline ? 'field-full' : '']">
                      <span class="field-label">
                        {{ field.title }}
                        <span v-if="field.required" class="field-required">*</span>
                      </span>

                      <select v-if="field.kind === 'enum'" v-model="message.input[field.key]" class="input">
                        <option v-for="option in field.enumValues" :key="option" :value="option">{{ option }}</option>
                      </select>

                      <textarea
                        v-else-if="field.kind === 'array' || field.multiline"
                        v-model="message.input[field.key]"
                        class="textarea"
                        :rows="field.kind === 'array' ? 4 : 5"
                        :placeholder="field.kind === 'array' ? '每行一个值' : ''"
                      />

                      <input
                        v-else-if="field.kind === 'number' || field.kind === 'integer'"
                        v-model.number="message.input[field.key]"
                        class="input"
                        type="number"
                        step="1"
                      />

                      <label v-else-if="field.kind === 'boolean'" class="check-row">
                        <input v-model="message.input[field.key]" type="checkbox" class="toggle" />
                        <span>启用</span>
                      </label>

                      <input v-else v-model="message.input[field.key]" class="input" />
                    </label>
                  </div>

                  <div v-if="message.error" class="notice notice-error">{{ message.error }}</div>

                  <div class="proposal-actions">
                    <button class="btn btn-primary" :disabled="message.pending" @click="confirmProposal(message.id)">
                      {{ message.pending ? '提交中...' : '确认运行' }}
                    </button>
                    <button class="btn btn-ghost" :disabled="message.pending" @click="cancelProposal(message.id)">取消</button>
                    <NuxtLink :to="`/admin/skills/${message.skill.slug}`" class="btn btn-ghost">详情页</NuxtLink>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="card run-card">
                  <div class="run-top">
                    <div>
                      <div class="run-label">执行卡片</div>
                      <div class="run-title">{{ message.skill.name }}</div>
                      <p class="run-desc">{{ message.userText }}</p>
                    </div>
                    <div class="run-badges">
                      <span :class="`badge badge-${message.run.status}`">{{ statusLabel(message.run.status) }}</span>
                      <span class="tag">{{ streamStateLabel(message.streamState) }}</span>
                    </div>
                  </div>

                  <div class="run-meta">
                    <span class="run-meta-item mono">{{ message.run.run_uid }}</span>
                    <span class="run-meta-item">{{ providerLabel(message.run.provider) }}</span>
                    <span class="run-meta-item">{{ engineLabel(message.run.engine_type) }}</span>
                    <NuxtLink :to="`/admin/runs/${message.run.run_uid}`" class="run-link">查看 Run 详情</NuxtLink>
                  </div>

                  <div class="progress-headline">{{ progressHeadline(message) }}</div>
                  <div class="progress-list">
                    <div v-for="step in progressSteps(message)" :key="step.key" class="progress-row">
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

                  <div v-if="message.run.status === 'waiting_approval' && message.approvals.length" class="approval-panel">
                    <div class="approval-title">待审批</div>
                    <div v-for="approval in message.approvals" :key="approval.id" class="approval-row">
                      <div>
                        <div class="approval-message">{{ approval.human_message }}</div>
                        <div class="approval-meta">
                          <span class="tag">{{ approval.scope }}</span>
                          <span :class="`badge badge-approval-${approval.status}`">{{ approvalStatusLabel(approval.status) }}</span>
                        </div>
                      </div>
                      <div v-if="approval.status === 'pending'" class="approval-actions">
                        <button class="btn btn-primary" :disabled="message.approvalPending" @click="approveRun(message.run.run_uid, approval.id)">
                          批准
                        </button>
                        <button class="btn btn-ghost btn-danger" :disabled="message.approvalPending" @click="rejectRun(message.run.run_uid, approval.id)">
                          拒绝
                        </button>
                      </div>
                    </div>
                    <div v-if="message.approvalError" class="notice notice-error">{{ message.approvalError }}</div>
                  </div>

                  <div v-if="failureHints(message).length" class="progress-hints">
                    <div class="progress-hints-title">建议排查</div>
                    <ul class="progress-hints-list">
                      <li v-for="hint in failureHints(message)" :key="hint">{{ hint }}</li>
                    </ul>
                  </div>

                  <div v-if="outputPreview(message)" class="output-preview">
                    <div class="section-title">输出预览</div>
                    <pre class="code-block">{{ outputPreview(message) }}</pre>
                  </div>
                </div>
              </template>
            </div>
          </template>

          <template v-else>
            <div class="empty-state">
              <div class="empty-title">先用一句自然语言描述需求</div>
              <p class="empty-sub">这个 MVP 会先匹配最合适的内置 skill，再给你一张可编辑的确认卡片。</p>

              <div v-if="starterCards.length" class="starter-list">
                <button
                  v-for="starter in starterCards"
                  :key="starter.key"
                  class="starter-card"
                  type="button"
                  @click="startFromExample(starter.skill, starter.example, starter.exampleIndex)"
                >
                  <div class="starter-skill">{{ starter.skill.name }}</div>
                  <div class="starter-title">{{ starter.example.title }}</div>
                  <div v-if="starter.example.prompt" class="starter-prompt">{{ starter.example.prompt }}</div>
                </button>
              </div>
            </div>
          </template>
        </section>

        <form class="card composer-panel" @submit.prevent="submitPrompt">
          <label class="composer-field">
            <span class="section-title">输入需求</span>
            <textarea
              v-model="composer"
              class="composer-input"
              rows="5"
              placeholder="例如：帮我把 Clean Architecture 拆成学习路径，面向 3 年 Web 工程师"
              @keydown="handleComposerKeydown"
            />
          </label>

          <div class="composer-actions">
            <button class="btn btn-primary" type="submit" :disabled="!composer.trim() || submitting">
              {{ submitting ? '处理中...' : '发送并匹配' }}
            </button>
            <button class="btn btn-ghost" type="button" :disabled="submitting || !composer" @click="composer = ''">清空</button>
            <span class="composer-hint">`Ctrl/Cmd + Enter` 发送。当前只支持内置 skill。</span>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { SkillChatSessionRecord as SkillChatSessionRemoteRecord } from '~/types/skillChat'
import type {
  ApprovalRequest,
  ApprovalStatus,
  Artifact,
  EngineType,
  Provider,
  RunStatus,
  SkillDefinitionDetail,
  SkillExample,
  SkillRunDetail,
  SkillRunEvent,
} from '~/types/skill'

definePageMeta({ layout: 'admin', middleware: 'auth' })

type ChatRole = 'user' | 'assistant'
type StreamState = 'idle' | 'connecting' | 'live' | 'closed' | 'error'
type Confidence = 'high' | 'medium' | 'low'
type SchemaFieldKind = 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'array'
type ProgressStepStatus = 'done' | 'current' | 'pending' | 'failed'

interface SchemaField {
  key: string
  title: string
  kind: SchemaFieldKind
  enumValues: string[]
  multiline: boolean
  required: boolean
}

interface ProgressStep {
  key: string
  title: string
  description: string
  status: ProgressStepStatus
}

interface BaseMessage {
  id: string
  kind: 'text' | 'proposal' | 'run'
  role: ChatRole
  createdAt: string
}

interface TextMessage extends BaseMessage {
  kind: 'text'
  text: string
}

interface ProposalMessage extends BaseMessage {
  kind: 'proposal'
  role: 'assistant'
  userText: string
  skill: SkillDefinitionDetail
  confidence: Confidence
  reasons: string[]
  fields: SchemaField[]
  input: Record<string, any>
  pending: boolean
  error: string
}

interface RunMessage extends BaseMessage {
  kind: 'run'
  role: 'assistant'
  userText: string
  skill: SkillDefinitionDetail
  inputPayload: Record<string, unknown>
  run: SkillRunDetail
  approvals: ApprovalRequest[]
  artifacts: Artifact[]
  events: SkillRunEvent[]
  streamState: StreamState
  approvalPending: boolean
  approvalError: string
}

type ChatMessage = TextMessage | ProposalMessage | RunMessage

interface ChatSessionRecord {
  id: string
  title: string
  preview: string
  messageCount: number
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

interface ChatSessionSummary {
  id: string
  title: string
  preview: string
  messageCount: number
  updatedAt: string
}

interface SkillMatch {
  skill: SkillDefinitionDetail
  confidence: Confidence
  reasons: string[]
}

const api = useApi()
const loading = ref(false)
const error = ref('')
const sessionError = ref('')
const submitting = ref(false)
const composer = ref('')
const messages = ref<ChatMessage[]>([])
const builtinSkills = ref<SkillDefinitionDetail[]>([])
const sessions = ref<ChatSessionRecord[]>([])
const currentSessionId = ref('')
const messageViewport = ref<HTMLElement | null>(null)
const runStreams = new Map<string, EventSource>()
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
let persistTimer: ReturnType<typeof setTimeout> | null = null
let sessionsReady = false
let applyingSession = false

const starterCards = computed(() =>
  builtinSkills.value.flatMap(skill => {
    const example = skillExamples(skill)[0]
    if (!example) return []
    return [{
      key: `${skill.slug}-0`,
      skill,
      example,
      exampleIndex: 0,
    }]
  })
)
const sessionSummaries = computed<ChatSessionSummary[]>(() =>
  sessions.value.map(session => ({
    id: session.id,
    title: session.title || '新会话',
    preview: session.preview || sessionPreview(session.messages),
    messageCount: session.messageCount,
    updatedAt: session.updatedAt,
  }))
)

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function truncateText(value: string, limit = 36): string {
  const text = value.trim()
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function sessionTitleFromMessages(list: ChatMessage[]): string {
  for (const message of list) {
    if (message.kind === 'text' && message.role === 'user' && message.text.trim()) {
      return truncateText(message.text, 24)
    }
    if ((message.kind === 'proposal' || message.kind === 'run') && message.userText.trim()) {
      return truncateText(message.userText, 24)
    }
  }
  return '新会话'
}

function sessionPreview(list: ChatMessage[]): string {
  const last = list[list.length - 1]
  if (!last) return '还没有消息'
  if (last.kind === 'text') return truncateText(last.text, 44) || '文本消息'
  if (last.kind === 'proposal') return `待确认: ${last.skill.name}`
  return `${last.skill.name} · ${statusLabel(last.run.status)}`
}

function sortSessions(list: ChatSessionRecord[]): ChatSessionRecord[] {
  return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function upsertSession(session: ChatSessionRecord): void {
  const rest = sessions.value.filter(item => item.id !== session.id)
  sessions.value = sortSessions([session, ...rest])
}

function resolveBuiltinSkill(skill: SkillDefinitionDetail): SkillDefinitionDetail {
  return builtinSkills.value.find(item => item.slug === skill.slug) || skill
}

function reviveStoredMessages(list: unknown): ChatMessage[] {
  if (!Array.isArray(list)) return []
  const result: ChatMessage[] = []

  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const raw = item as Record<string, any>
    const kind = String(raw.kind || '')
    const role = raw.role === 'user' ? 'user' : 'assistant'
    const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : makeId('restored')
    const createdAt = typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : new Date().toISOString()

    if (kind === 'text') {
      result.push({
        id,
        kind: 'text',
        role,
        createdAt,
        text: typeof raw.text === 'string' ? raw.text : '',
      } satisfies TextMessage)
      continue
    }

    if (kind === 'proposal' && raw.skill && typeof raw.skill === 'object') {
      const skill = resolveBuiltinSkill(raw.skill as SkillDefinitionDetail)
      result.push({
        id,
        kind: 'proposal',
        role: 'assistant',
        createdAt,
        userText: typeof raw.userText === 'string' ? raw.userText : '',
        skill,
        confidence: raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low' ? raw.confidence : 'medium',
        reasons: Array.isArray(raw.reasons) ? raw.reasons.map((reason: unknown) => String(reason || '').trim()).filter(Boolean) : [],
        fields: schemaFieldsFor(skill),
        input: raw.input && typeof raw.input === 'object' && !Array.isArray(raw.input)
          ? raw.input as Record<string, any>
          : seedProposalInput(skill, sampleInputFromSchema(skill)),
        pending: false,
        error: typeof raw.error === 'string' ? raw.error : '',
      } satisfies ProposalMessage)
      continue
    }

    if (kind === 'run' && raw.skill && raw.run && typeof raw.skill === 'object' && typeof raw.run === 'object') {
      const skill = resolveBuiltinSkill(raw.skill as SkillDefinitionDetail)
      const run = raw.run as SkillRunDetail
      result.push({
        id,
        kind: 'run',
        role: 'assistant',
        createdAt,
        userText: typeof raw.userText === 'string' ? raw.userText : '',
        skill,
        inputPayload: raw.inputPayload && typeof raw.inputPayload === 'object' && !Array.isArray(raw.inputPayload)
          ? raw.inputPayload as Record<string, unknown>
          : {},
        run,
        approvals: Array.isArray(raw.approvals) ? raw.approvals as ApprovalRequest[] : [],
        artifacts: Array.isArray(raw.artifacts) ? raw.artifacts as Artifact[] : [],
        events: Array.isArray(raw.events) ? raw.events as SkillRunEvent[] : [],
        streamState: isTerminal(run.status) ? 'closed' : 'idle',
        approvalPending: false,
        approvalError: typeof raw.approvalError === 'string' ? raw.approvalError : '',
      } satisfies RunMessage)
    }
  }

  return result
}

function closeAllRunStreams(): void {
  for (const runUid of Array.from(runStreams.keys())) closeRunStream(runUid)
}

function buildSessionSnapshot(list: ChatMessage[], fallbackTitle = '新会话'): Pick<ChatSessionRecord, 'title' | 'preview' | 'messageCount' | 'messages'> {
  const snapshot = deepClone(list)
  return {
    title: sessionTitleFromMessages(snapshot) || fallbackTitle || '新会话',
    preview: sessionPreview(snapshot),
    messageCount: snapshot.length,
    messages: snapshot,
  }
}

function normalizeServerSession(session: SkillChatSessionRemoteRecord): ChatSessionRecord {
  const revivedMessages = reviveStoredMessages(session.messages)
  const snapshot = buildSessionSnapshot(revivedMessages, session.title || '新会话')
  return {
    id: session.id,
    title: snapshot.title,
    preview: session.preview || snapshot.preview,
    messageCount: snapshot.messageCount,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: snapshot.messages,
  }
}

async function rehydrateCurrentRunMessages(): Promise<void> {
  const runMessages = messages.value.filter((message): message is RunMessage => message.kind === 'run')
  for (const message of runMessages) {
    try {
      await refreshRunMessage(message.run.run_uid)
      connectRunStream(message.run.run_uid)
    } catch {
      updateRunMessage(message.run.run_uid, entry => {
        entry.streamState = isTerminal(entry.run.status) ? 'closed' : 'error'
      })
    }
  }
}

function applySession(session: ChatSessionRecord): void {
  closeAllRunStreams()
  applyingSession = true
  currentSessionId.value = session.id
  messages.value = reviveStoredMessages(deepClone(session.messages))
  void nextTick(() => {
    applyingSession = false
  })
  queueScrollToBottom()
  void rehydrateCurrentRunMessages()
}

function syncCurrentSessionDraft(): void {
  if (!sessionsReady || !currentSessionId.value) return
  const existing = sessions.value.find(session => session.id === currentSessionId.value)
  if (!existing) return

  upsertSession({
    ...existing,
    ...buildSessionSnapshot(messages.value, existing.title),
    updatedAt: new Date().toISOString(),
  })
}

async function saveCurrentSessionNow(sessionId = currentSessionId.value): Promise<boolean> {
  if (!sessionsReady || !sessionId) return true
  const existing = sessions.value.find(session => session.id === sessionId)
  if (!existing) return true

  const snapshot = sessionId === currentSessionId.value
    ? deepClone(messages.value)
    : deepClone(existing.messages)
  const payload = buildSessionSnapshot(snapshot, existing.title)

  upsertSession({
    ...existing,
    ...payload,
    updatedAt: new Date().toISOString(),
  })

  try {
    await api.updateSkillChatSession(sessionId, payload)
    sessionError.value = ''
    return true
  } catch (err) {
    sessionError.value = (err as Error).message
    return false
  }
}

async function flushPersistCurrentSession(): Promise<boolean> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  return saveCurrentSessionNow()
}

function schedulePersistCurrentSession(): void {
  if (!sessionsReady || !currentSessionId.value) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void saveCurrentSessionNow()
  }, 180)
}

async function createNewSession(): Promise<void> {
  sessionError.value = ''
  if (currentSessionId.value) await flushPersistCurrentSession()
  try {
    const session = normalizeServerSession(await api.createSkillChatSession())
    upsertSession(session)
    applySession(session)
  } catch (err) {
    sessionError.value = (err as Error).message
  }
}

async function switchSession(sessionId: string): Promise<void> {
  if (sessionId === currentSessionId.value) return
  await flushPersistCurrentSession()
  const target = sessions.value.find(session => session.id === sessionId)
  if (!target) return
  applySession(target)
}

async function deleteSession(sessionId: string): Promise<void> {
  const target = sessions.value.find(session => session.id === sessionId)
  if (!target) return
  if (!window.confirm(`删除会话“${target.title}”？`)) return

  try {
    await api.deleteSkillChatSession(sessionId)
    sessionError.value = ''
  } catch (err) {
    sessionError.value = (err as Error).message
    return
  }

  const deletingCurrent = sessionId === currentSessionId.value
  sessions.value = sessions.value.filter(session => session.id !== sessionId)

  if (!sessions.value.length) {
    if (deletingCurrent) {
      closeAllRunStreams()
      currentSessionId.value = ''
      messages.value = []
    }
    await createNewSession()
    return
  }

  if (deletingCurrent) {
    closeAllRunStreams()
    applySession(sessions.value[0])
  }
}

async function loadSessionsFromServer(): Promise<void> {
  const response = await api.getSkillChatSessions()
  sessions.value = sortSessions(response.data.map(normalizeServerSession))

  if (!sessions.value.length) {
    const created = normalizeServerSession(await api.createSkillChatSession())
    sessions.value = [created]
  }

  applySession(sessions.value[0])
}

function pushMessage(message: ChatMessage): void {
  messages.value = [...messages.value, message]
  queueScrollToBottom()
}

function replaceMessage(messageId: string, nextMessage: ChatMessage): void {
  messages.value = messages.value.map(message => message.id === messageId ? nextMessage : message)
  queueScrollToBottom()
}

function updateRunMessage(runUid: string, updater: (message: RunMessage) => void): void {
  const index = messages.value.findIndex(message => message.kind === 'run' && message.run.run_uid === runUid)
  if (index === -1) return
  const current = messages.value[index]
  if (current.kind !== 'run') return
  updater(current)
  messages.value = [...messages.value]
}

function updateProposalMessage(messageId: string, updater: (message: ProposalMessage) => void): void {
  const index = messages.value.findIndex(message => message.id === messageId)
  if (index === -1) return
  const current = messages.value[index]
  if (current.kind !== 'proposal') return
  updater(current)
  messages.value = [...messages.value]
}

function queueScrollToBottom(): void {
  nextTick(() => {
    const el = messageViewport.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function skillExamples(skill: SkillDefinitionDetail): SkillExample[] {
  const raw = skill.source_metadata?.examples
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const input = item.input && typeof item.input === 'object' && !Array.isArray(item.input)
      ? item.input as Record<string, unknown>
      : {}
    return [{
      title: String(item.title || `示例 ${index + 1}`).trim(),
      prompt: typeof item.prompt === 'string' && item.prompt.trim() ? item.prompt.trim() : undefined,
      note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
      input,
    }]
  })
}

function schemaFieldsFor(skill: SkillDefinitionDetail): SchemaField[] {
  const schema = skill.input_schema
  const properties = schema?.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return []

  const requiredSet = new Set(Array.isArray(schema.required) ? schema.required.map(item => String(item)) : [])
  return Object.entries(properties as Record<string, unknown>).map(([key, value]) => {
    const field = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    const enumValues = Array.isArray(field.enum) ? field.enum.map(item => String(item)) : []
    const type = String(field.type || 'string')
    const kind: SchemaFieldKind = enumValues.length
      ? 'enum'
      : type === 'number'
        ? 'number'
        : type === 'integer'
          ? 'integer'
          : type === 'boolean'
            ? 'boolean'
            : type === 'array'
              ? 'array'
              : 'string'

    return {
      key,
      title: String(field.title || key),
      kind,
      enumValues,
      multiline: kind === 'string' && /(content|context|notes|note|audience|summary)/i.test(key),
      required: requiredSet.has(key),
    }
  })
}

function sampleInputFromSchema(skill: SkillDefinitionDetail): Record<string, unknown> {
  const properties = skill.input_schema?.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
    const field = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}

    if (Array.isArray(field.enum) && field.enum.length) {
      result[key] = field.enum[0]
      continue
    }

    switch (field.type) {
      case 'number':
      case 'integer':
        result[key] = 0
        break
      case 'boolean':
        result[key] = false
        break
      case 'array':
        result[key] = []
        break
      default:
        result[key] = ''
    }
  }
  return result
}

function seedProposalInput(skill: SkillDefinitionDetail, seed: Record<string, unknown>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const field of schemaFieldsFor(skill)) {
    const current = seed[field.key]
    switch (field.kind) {
      case 'boolean':
        result[field.key] = !!current
        break
      case 'number':
      case 'integer':
        result[field.key] = typeof current === 'number' ? current : 0
        break
      case 'array':
        result[field.key] = Array.isArray(current) ? current.map(item => String(item)).join('\n') : ''
        break
      default:
        result[field.key] = typeof current === 'string' ? current : String(current ?? '')
    }
  }
  return result
}

function buildPayloadFromProposal(message: ProposalMessage): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of message.fields) {
    const raw = message.input[field.key]
    switch (field.kind) {
      case 'boolean':
        payload[field.key] = !!raw
        break
      case 'number':
      case 'integer':
        payload[field.key] = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
        break
      case 'array':
        payload[field.key] = String(raw || '')
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean)
        break
      default:
        payload[field.key] = typeof raw === 'string' ? raw : String(raw ?? '')
    }
  }
  return payload
}

function missingRequiredFields(message: ProposalMessage): string[] {
  const payload = buildPayloadFromProposal(message)
  return message.fields
    .filter(field => field.required)
    .filter(field => {
      const value = payload[field.key]
      if (field.kind === 'array') return !Array.isArray(value) || value.length === 0
      if (field.kind === 'boolean') return false
      if (field.kind === 'number' || field.kind === 'integer') return false
      return !String(value || '').trim()
    })
    .map(field => field.title)
}

function extractContentBlock(text: string): string {
  const lines = text.split('\n').map(line => line.trim())
  if (lines.length > 1) {
    const tail = lines.slice(1).filter(Boolean).join('\n')
    if (tail.length >= 16) return tail
  }

  const colonSplit = text.split(/[：:]/)
  if (colonSplit.length > 1) {
    const tail = colonSplit.slice(1).join(':').trim()
    if (tail.length >= 16) return tail
  }

  const quoteMatch = text.match(/[“"](.*)[”"]/)
  if (quoteMatch?.[1] && quoteMatch[1].trim().length >= 16) return quoteMatch[1].trim()
  return ''
}

function cleanTopic(value: string): string {
  return value
    .replace(/^(帮我|请|麻烦|想要|我想|给我)\s*/g, '')
    .replace(/[，。！？,.!?；;：:]+$/g, '')
    .trim()
}

function inferLearningTopic(text: string): string {
  const patterns = [
    /(?:把|将)(.+?)(?:拆成|整理成|做成)(?:一份|一个)?(?:学习路径|学习计划|学习地图|路线图|课程大纲)/,
    /(?:围绕|关于)(.+?)(?:做一份|做一个|生成一份|生成一个)?(?:学习路径|学习计划|学习地图|路线图|课程大纲)/,
    /(?:学习|研究)(.+?)(?:的)?(?:路径|计划|地图|路线图|大纲)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return cleanTopic(match[1])
  }

  return cleanTopic(
    text
      .replace(/学习路径|学习计划|学习地图|路线图|课程大纲|拆解|生成|做一个|做一份/g, ' ')
      .replace(/\s+/g, ' ')
  )
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function inferBriefingDate(text: string): string {
  const absolute = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (absolute?.[1]) return absolute[1]

  const base = new Date()
  if (/昨天/.test(text)) base.setDate(base.getDate() - 1)
  else if (/明天/.test(text)) base.setDate(base.getDate() + 1)
  return formatLocalDate(base)
}

function inferBriefingTopic(text: string): string {
  const match = text.match(/(?:关于|聚焦|主题[：:])(.+)/)
  if (match?.[1]) return cleanTopic(match[1])
  if (/模型|agent|代理|工作流/i.test(text)) return 'AI 模型与代理动态'
  if (/融资|投资|公司|发布/i.test(text)) return 'AI 产品与行业动态'
  return 'AI 产品与模型动态'
}

function inferAudience(text: string): string {
  const match = text.match(/面向([^，。；\n]+)/)
  if (match?.[1]) return `面向${match[1].trim()}`
  if (/工程师|开发者/.test(text)) return '关注模型、工作流和开发工具的技术读者'
  if (/产品/.test(text)) return '关注 AI 产品策略和落地节奏的产品读者'
  return '关注 AI 动态的产品和技术读者'
}

function inferSourceNotes(text: string): string {
  const match = text.match(/(?:关注|重点|优先关注)([^。；\n]+)/)
  return match?.[1]?.trim() || ''
}

function inferSkillInput(skill: SkillDefinitionDetail, userText: string): Record<string, unknown> {
  const draft = sampleInputFromSchema(skill)
  const trimmed = userText.trim()

  switch (skill.slug) {
    case 'article-summary-polisher': {
      const content = extractContentBlock(trimmed)
      draft.title = ''
      draft.content = content || ''
      draft.tone = /技术|technical/i.test(trimmed)
        ? 'technical'
        : /简短|简洁|brief/i.test(trimmed)
          ? 'brief'
          : 'neutral'
      return draft
    }

    case 'learning-topic-generator': {
      draft.topic = inferLearningTopic(trimmed)
      draft.source_type = /书|book|读本/i.test(trimmed)
        ? 'book'
        : /概念|concept/i.test(trimmed)
          ? 'concept'
          : 'skill'
      draft.depth = /深入|详细|系统|deep/i.test(trimmed)
        ? 'deep'
        : /简要|快速|brief/i.test(trimmed)
          ? 'brief'
          : 'standard'
      draft.context = inferAudience(trimmed)
      return draft
    }

    case 'daily-ai-briefing': {
      draft.date = inferBriefingDate(trimmed)
      draft.topic = inferBriefingTopic(trimmed)
      draft.locale = 'zh-CN'
      draft.audience = inferAudience(trimmed)
      draft.source_notes = inferSourceNotes(trimmed)
      return draft
    }

    default:
      return draft
  }
}

function matchSkill(userText: string): SkillMatch | null {
  const text = normalizeText(userText)
  let best: { score: number; match: SkillMatch } | null = null

  for (const skill of builtinSkills.value) {
    const reasons: string[] = []
    let score = 0
    const keywords = [
      ...stringList(skill.source_metadata?.trigger_keywords),
      ...stringList(skill.source_metadata?.tags),
      skill.name,
      skill.slug,
    ]

    for (const keyword of keywords) {
      const normalizedKeyword = normalizeText(keyword)
      if (!normalizedKeyword || normalizedKeyword.length < 2) continue
      if (text.includes(normalizedKeyword)) {
        score += normalizedKeyword.length >= 4 ? 6 : 4
        if (reasons.length < 4) reasons.push(`命中 ${keyword}`)
      }
    }

    if (skill.slug === 'article-summary-polisher') {
      if (/(摘要|总结|压缩|提炼|润色)/.test(userText)) {
        score += 12
        if (reasons.length < 4) reasons.push('像是在请求摘要/润色')
      }
      if (extractContentBlock(userText).length >= 16) {
        score += 4
        if (reasons.length < 4) reasons.push('输入里包含待处理正文')
      }
    }

    if (skill.slug === 'learning-topic-generator' && /(学习路径|学习计划|学习地图|路线图|课程大纲|拆解)/.test(userText)) {
      score += 12
      if (reasons.length < 4) reasons.push('像是在请求学习路径拆解')
    }

    if (skill.slug === 'daily-ai-briefing' && /(日报|简报|briefing|资讯汇总|播报)/i.test(userText)) {
      score += 12
      if (reasons.length < 4) reasons.push('像是在请求日报/简报工作流')
    }

    if (!best || score > best.score) {
      const confidence: Confidence = score >= 18 ? 'high' : score >= 10 ? 'medium' : 'low'
      best = {
        score,
        match: {
          skill,
          confidence,
          reasons: reasons.length ? reasons : ['命中默认意图匹配'],
        },
      }
    }
  }

  return best && best.score >= 8 ? best.match : null
}

function createProposalMessage(userText: string, skill: SkillDefinitionDetail, seed: Record<string, unknown>, reasons: string[], confidence: Confidence): ProposalMessage {
  return {
    id: makeId('proposal'),
    kind: 'proposal',
    role: 'assistant',
    createdAt: new Date().toISOString(),
    userText,
    skill,
    confidence,
    reasons,
    fields: schemaFieldsFor(skill),
    input: seedProposalInput(skill, seed),
    pending: false,
    error: '',
  }
}

function createTextMessage(role: ChatRole, text: string): TextMessage {
  return {
    id: makeId(role),
    kind: 'text',
    role,
    createdAt: new Date().toISOString(),
    text,
  }
}

async function hydrateRunMessage(messageId: string, userText: string, skill: SkillDefinitionDetail, payload: Record<string, unknown>, run: SkillRunDetail): Promise<RunMessage> {
  const [eventsRes, approvalsRes, artifactsRes] = await Promise.all([
    api.getSkillRunEvents(run.run_uid),
    api.getSkillRunApprovals(run.run_uid),
    api.getSkillRunArtifacts(run.run_uid),
  ])

  return {
    id: messageId,
    kind: 'run',
    role: 'assistant',
    createdAt: new Date().toISOString(),
    userText,
    skill,
    inputPayload: payload,
    run,
    approvals: approvalsRes.data,
    artifacts: artifactsRes.data,
    events: eventsRes.data,
    streamState: isTerminal(run.status) ? 'closed' : 'idle',
    approvalPending: false,
    approvalError: '',
  }
}

async function refreshRunMessage(runUid: string): Promise<void> {
  const [runRes, eventsRes, approvalsRes, artifactsRes] = await Promise.all([
    api.getSkillRun(runUid),
    api.getSkillRunEvents(runUid),
    api.getSkillRunApprovals(runUid),
    api.getSkillRunArtifacts(runUid),
  ])

  updateRunMessage(runUid, message => {
    message.run = runRes
    message.events = eventsRes.data
    message.approvals = approvalsRes.data
    message.artifacts = artifactsRes.data
    if (isTerminal(runRes.status)) message.streamState = 'closed'
  })
}

function closeRunStream(runUid: string): void {
  const source = runStreams.get(runUid)
  if (source) {
    source.close()
    runStreams.delete(runUid)
  }
  const timer = reconnectTimers.get(runUid)
  if (timer) {
    clearTimeout(timer)
    reconnectTimers.delete(runUid)
  }
}

function mergeEvents(existing: SkillRunEvent[], incoming: SkillRunEvent[]): SkillRunEvent[] {
  const map = new Map<number, SkillRunEvent>()
  for (const item of existing) map.set(item.seq, item)
  for (const item of incoming) map.set(item.seq, item)
  return Array.from(map.values()).sort((a, b) => a.seq - b.seq)
}

function connectRunStream(runUid: string): void {
  const message = messages.value.find(item => item.kind === 'run' && item.run.run_uid === runUid)
  if (!message || message.kind !== 'run') return
  if (isTerminal(message.run.status)) {
    updateRunMessage(runUid, entry => { entry.streamState = 'closed' })
    return
  }
  if (!import.meta.client || runStreams.has(runUid)) return

  updateRunMessage(runUid, entry => { entry.streamState = 'connecting' })
  const since = message.events.length ? message.events[message.events.length - 1].seq : 0
  const source = new EventSource(`/api/skill-runs/${runUid}/stream?since=${since}`)
  runStreams.set(runUid, source)

  source.addEventListener('skill-run-event', async (raw) => {
    const event = JSON.parse((raw as MessageEvent).data) as SkillRunEvent
    updateRunMessage(runUid, entry => {
      entry.streamState = 'live'
      entry.events = mergeEvents(entry.events, [event])
    })

    if (event.event_type === 'run.started' || event.event_type === 'run.completed' || event.event_type === 'run.failed' || event.event_type === 'run.cancelled') {
      await refreshRunMessage(runUid)
    }
    if (event.event_type.startsWith('approval.')) {
      await refreshRunMessage(runUid)
    }
    if (event.event_type === 'artifact.created') {
      await refreshRunMessage(runUid)
    }

    const latest = messages.value.find(item => item.kind === 'run' && item.run.run_uid === runUid)
    if (latest && latest.kind === 'run' && isTerminal(latest.run.status)) {
      closeRunStream(runUid)
    }
  })

  source.addEventListener('stream.end', async () => {
    await refreshRunMessage(runUid)
    updateRunMessage(runUid, entry => { entry.streamState = 'closed' })
    closeRunStream(runUid)
  })

  source.onerror = async () => {
    closeRunStream(runUid)
    const latest = messages.value.find(item => item.kind === 'run' && item.run.run_uid === runUid)
    if (!latest || latest.kind !== 'run' || isTerminal(latest.run.status)) {
      updateRunMessage(runUid, entry => { entry.streamState = 'closed' })
      return
    }

    updateRunMessage(runUid, entry => { entry.streamState = 'error' })
    const timer = setTimeout(() => {
      reconnectTimers.delete(runUid)
      connectRunStream(runUid)
    }, 1500)
    reconnectTimers.set(runUid, timer)
  }
}

function isTerminal(status: RunStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

async function submitPrompt(): Promise<void> {
  const text = composer.value.trim()
  if (!text || submitting.value) return

  submitting.value = true
  composer.value = ''
  pushMessage(createTextMessage('user', text))

  try {
    const match = matchSkill(text)
    if (!match) {
      pushMessage(createTextMessage('assistant', `当前 chat MVP 只会匹配这几个内置 skill：${builtinSkills.value.map(skill => skill.name).join('、')}。如果需求偏离这几个能力，建议改用 /admin/skills 手动选择。`))
      return
    }

    const seed = inferSkillInput(match.skill, text)
    pushMessage(createProposalMessage(text, match.skill, seed, match.reasons, match.confidence))
  } finally {
    submitting.value = false
  }
}

async function confirmProposal(messageId: string): Promise<void> {
  const current = messages.value.find(message => message.id === messageId)
  if (!current || current.kind !== 'proposal') return

  const missing = missingRequiredFields(current)
  if (missing.length) {
    updateProposalMessage(messageId, message => {
      message.error = `还缺少必填字段：${missing.join('、')}`
    })
    return
  }

  updateProposalMessage(messageId, message => {
    message.pending = true
    message.error = ''
  })

  try {
    const payload = buildPayloadFromProposal(current)
    const run = await api.createSkillRun({
      skill_slug: current.skill.slug,
      input: payload,
    })
    const runMessage = await hydrateRunMessage(messageId, current.userText, current.skill, payload, run)
    replaceMessage(messageId, runMessage)
    connectRunStream(run.run_uid)
  } catch (err) {
    updateProposalMessage(messageId, message => {
      message.pending = false
      message.error = (err as Error).message
    })
  }
}

function cancelProposal(messageId: string): void {
  messages.value = messages.value.filter(message => message.id !== messageId)
  pushMessage(createTextMessage('assistant', '本次建议已取消，你可以换一种说法再试。'))
}

async function approveRun(runUid: string, approvalId: number): Promise<void> {
  updateRunMessage(runUid, message => {
    message.approvalPending = true
    message.approvalError = ''
  })

  try {
    const result = await api.approveSkillRunApproval(runUid, approvalId)
    updateRunMessage(runUid, message => {
      message.run = result.run
    })
    await refreshRunMessage(runUid)
    connectRunStream(runUid)
  } catch (err) {
    updateRunMessage(runUid, message => {
      message.approvalError = (err as Error).message
    })
  } finally {
    updateRunMessage(runUid, message => {
      message.approvalPending = false
    })
  }
}

async function rejectRun(runUid: string, approvalId: number): Promise<void> {
  updateRunMessage(runUid, message => {
    message.approvalPending = true
    message.approvalError = ''
  })

  try {
    const result = await api.rejectSkillRunApproval(runUid, approvalId)
    updateRunMessage(runUid, message => {
      message.run = result.run
    })
    await refreshRunMessage(runUid)
  } catch (err) {
    updateRunMessage(runUid, message => {
      message.approvalError = (err as Error).message
    })
  } finally {
    updateRunMessage(runUid, message => {
      message.approvalPending = false
    })
  }
}

function startFromExample(skill: SkillDefinitionDetail, example: SkillExample, exampleIndex: number): void {
  const prompt = example.prompt || `${skill.name} 示例 ${exampleIndex + 1}`
  pushMessage(createTextMessage('user', prompt))
  pushMessage(createProposalMessage(
    prompt,
    skill,
    example.input || sampleInputFromSchema(skill),
    [`示例 ${exampleIndex + 1}`, '直接使用内置推荐参数'],
    'high'
  ))
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  if (!(event.metaKey || event.ctrlKey)) return
  event.preventDefault()
  submitPrompt()
}

function eventMap(message: RunMessage): Map<string, SkillRunEvent> {
  const map = new Map<string, SkillRunEvent>()
  for (const item of message.events) map.set(item.event_type, item)
  return map
}

function progressHeadline(message: RunMessage): string {
  return ({
    queued: '运行请求已创建，等待进入执行阶段。',
    running: '任务正在执行中，可在这里直接观察阶段进度。',
    waiting_approval: '当前停在审批阶段，批准后会继续执行。',
    succeeded: '运行已完成，输出和产物都已落盘。',
    failed: '运行失败，建议先看失败阶段和排查建议。',
    cancelled: '运行已取消，可修改参数后重新发起。',
  } as const)[message.run.status] || message.run.status
}

function progressSteps(message: RunMessage): ProgressStep[] {
  const steps: ProgressStep[] = []
  const events = eventMap(message)
  const hasEvent = (type: string) => events.has(type)
  const getEvent = (type: string) => events.get(type) || null

  steps.push({
    key: 'created',
    title: '创建请求',
    description: 'Skill run 已写入数据库并准备进入执行链路。',
    status: hasEvent('run.created') ? 'done' : 'current',
  })

  const anyApprovalRejected = message.approvals.some(item => item.status === 'rejected')
  const anyApprovalApproved = message.approvals.some(item => item.status === 'approved')
  const needsApproval = message.approvals.length > 0 || hasEvent('approval.requested')
  if (needsApproval) {
    const pendingScopes = message.approvals
      .filter(item => item.status === 'pending')
      .map(item => item.scope)
      .filter(Boolean)
    steps.push({
      key: 'approval',
      title: '等待审批',
      description: anyApprovalRejected
        ? '审批被拒绝，运行不会继续。'
        : pendingScopes.length
          ? `待批准范围：${pendingScopes.join(' / ')}`
          : '该 skill 命中默认权限边界，批准后才会继续执行。',
      status: anyApprovalRejected
        ? 'failed'
        : anyApprovalApproved || hasEvent('run.started')
          ? 'done'
          : message.run.status === 'waiting_approval'
            ? 'current'
            : 'pending',
    })
  }

  if (message.run.engine_type === 'agent_sdk') {
    steps.push(
      buildPhaseStep(
        message.run.status,
        hasEvent('run.started'),
        getEvent('agent.research.started'),
        getEvent('agent.research.completed'),
        'research',
        '研究资料',
        event => {
          const combined = Number(event.payload.combined || 0)
          const articles = Number(event.payload.articles || 0)
          const socials = Number(event.payload.socials || 0)
          return `已汇总 ${combined} 条线索（文章 ${articles} / 社交 ${socials}）。`
        },
        '正在收集可用来源与研究线索。'
      ),
      buildPhaseStep(
        message.run.status,
        hasEvent('agent.research.completed'),
        getEvent('agent.plan.started'),
        getEvent('agent.plan.completed'),
        'plan',
        '规划结构',
        event => {
          const sections = Number(event.payload.sections || 0)
          const watchItems = Number(event.payload.watch_items || 0)
          return `已生成 ${sections} 个结构段落，附带 ${watchItems} 个跟踪项。`
        },
        '正在生成草稿结构与章节规划。'
      ),
      buildPhaseStep(
        message.run.status,
        hasEvent('agent.plan.completed'),
        getEvent('agent.compose.started'),
        getEvent('agent.compose.completed'),
        'compose',
        '撰写输出',
        event => `已产出约 ${Number(event.payload.chars || 0)} 个字符的 Markdown 草稿。`,
        '正在把规划转换成最终 Markdown 草稿。'
      ),
    )
  } else {
    steps.push(buildPhaseStep(
      message.run.status,
      hasEvent('run.started'),
      getEvent('engine.started'),
      getEvent('engine.completed'),
      'engine',
      '调用模型',
      event => `模型返回 ${Array.isArray(event.payload.keys) ? event.payload.keys.length : 0} 个输出字段。`,
      '正在把输入发送给当前 skill 对应的模型执行。'
    ))
  }

  steps.push({
    key: 'final',
    title: '完成落盘',
    description: message.run.status === 'succeeded'
      ? `运行完成${message.artifacts.length ? `，并生成 ${message.artifacts.length} 个产物。` : '，当前没有额外产物。'}`
      : message.run.status === 'failed'
        ? (message.run.error_message || '运行失败，请查看日志。')
        : message.run.status === 'cancelled'
          ? (message.run.error_message || '运行已取消。')
          : '等待执行链路完成并写入最终输出。',
    status: message.run.status === 'succeeded'
      ? 'done'
      : message.run.status === 'failed' || message.run.status === 'cancelled'
        ? 'failed'
        : hasEvent('engine.completed') || hasEvent('agent.compose.completed')
          ? 'current'
          : 'pending',
  })

  return steps
}

function buildPhaseStep(
  runStatus: RunStatus,
  eligible: boolean,
  startedEvent: SkillRunEvent | null,
  completedEvent: SkillRunEvent | null,
  key: string,
  title: string,
  completedDescription: (event: SkillRunEvent) => string,
  pendingDescription: string,
): ProgressStep {
  let status: ProgressStepStatus = 'pending'
  if (completedEvent) status = 'done'
  else if (runStatus === 'failed' || runStatus === 'cancelled') status = startedEvent || eligible ? 'failed' : 'pending'
  else if (startedEvent) status = 'current'
  else if (eligible) status = 'pending'

  return {
    key,
    title,
    description: completedEvent ? completedDescription(completedEvent) : pendingDescription,
    status,
  }
}

function failureHints(message: RunMessage): string[] {
  const errorMessage = message.run.error_message?.trim() || ''
  if (!errorMessage) return []

  const hints: string[] = []
  if (errorMessage.includes('不能为空') || errorMessage.includes('Input JSON')) {
    hints.push('先检查必填字段是否仍为空，尤其是 content、topic、date 这类核心输入。')
  }
  if (errorMessage.includes('API error') || errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('quota') || errorMessage.includes('配额')) {
    hints.push('去模型设置页或 Anthropic 调试页确认 base URL、认证头、模型名和额度状态。')
  }
  if (errorMessage.includes('重启') || errorMessage.includes('中断')) {
    hints.push('这是可重试型错误；确认服务稳定后重新发起一次运行即可。')
  }
  if (!hints.length) {
    hints.push('先看运行详情页里的原始事件流，区分是参数问题、审批阻塞还是模型路由异常。')
  }
  return hints
}

function outputPreview(message: RunMessage): string {
  const output = message.run.output || {}
  if (typeof output.summary === 'string' && output.summary.trim()) return output.summary.trim()
  if (typeof output.markdown === 'string' && output.markdown.trim()) return output.markdown.trim().slice(0, 1200)
  if (typeof output.title === 'string' || Array.isArray(output.chapters)) {
    return JSON.stringify({
      title: output.title || '',
      chapters: Array.isArray(output.chapters) ? output.chapters.slice(0, 3) : [],
    }, null, 2)
  }
  return ''
}

function confidenceLabel(confidence: Confidence): string {
  return ({
    high: '高置信度',
    medium: '中置信度',
    low: '低置信度',
  } as const)[confidence] || confidence
}

function progressStateLabel(status: ProgressStepStatus): string {
  return ({
    done: '已完成',
    current: '进行中',
    pending: '待开始',
    failed: '失败',
  } as const)[status] || status
}

function streamStateLabel(state: StreamState): string {
  return ({
    idle: '待连接',
    connecting: '连接中',
    live: '实时中',
    closed: '已结束',
    error: '连接异常',
  } as const)[state] || state
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

function approvalStatusLabel(status: ApprovalStatus): string {
  return ({
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
  } as const)[status] || status
}

function providerLabel(provider: Provider): string {
  return ({ openai: 'OpenAI', anthropic: 'Anthropic', external: 'External' } as const)[provider] || provider
}

function engineLabel(engine: EngineType): string {
  return ({ llm_direct: 'Direct', agent_sdk: 'Agent SDK', external: 'External' } as const)[engine] || engine
}

function formatSessionTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  sessionError.value = ''
  sessionsReady = false
  try {
    const summary = await api.getSkills({ source_origin: 'builtin', status: 'active' })
    const details = await Promise.all(summary.data.map(skill => api.getSkill(skill.slug)))
    builtinSkills.value = details
      .filter(skill => skill.source_origin === 'builtin' && skill.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    await loadSessionsFromServer()
    sessionsReady = true
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(messages, () => {
  if (applyingSession) return
  syncCurrentSessionDraft()
  schedulePersistCurrentSession()
}, { deep: true })
onBeforeUnmount(() => {
  void flushPersistCurrentSession()
  closeAllRunStreams()
})
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1.5px solid var(--border);
  padding-bottom: 1.25rem;
}
.page-title { font-size: 1.45rem; font-weight: 700; letter-spacing: -0.03em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; max-width: 72ch; }

.chat-shell { display: grid; grid-template-columns: 260px minmax(0, 1fr) 360px; gap: 1rem; align-items: start; }
.session-panel {
  position: sticky;
  top: 1rem;
  padding: 1rem;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
}
.session-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}
.session-sub { margin-top: 0.25rem; color: var(--text-muted); font-size: 0.8rem; line-height: 1.5; }
.session-error { margin-bottom: 0.8rem; }
.session-list { display: flex; flex-direction: column; gap: 0.7rem; }
.session-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  text-align: left;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.session-item:hover { border-color: var(--accent); transform: translateY(-1px); }
.session-item-active {
  border-color: color-mix(in oklab, var(--accent) 36%, var(--border));
  background: var(--bg-raised);
}
.session-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.session-title { font-size: 0.88rem; font-weight: 700; line-height: 1.4; }
.session-preview { color: var(--text-muted); font-size: 0.79rem; line-height: 1.5; }
.session-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.74rem;
}
.session-delete {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.05rem;
  line-height: 1;
  padding: 0;
}
.session-delete:hover { color: #dc2626; }
.chat-panel {
  min-height: 620px;
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.composer-panel {
  position: sticky;
  top: 1rem;
  padding: 1rem;
}
.btn-sm { min-height: 34px; padding: 0.45rem 0.7rem; font-size: 0.8rem; }
.composer-field { display: flex; flex-direction: column; gap: 0.5rem; }
.composer-input {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.85rem 0.9rem;
  font: inherit;
  resize: vertical;
  min-height: 140px;
}
.composer-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.9rem; }
.composer-hint { color: var(--text-muted); font-size: 0.8rem; }

.support-card { padding: 1rem 1.1rem; margin-bottom: 1rem; }
.support-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.support-sub { margin-top: 0.25rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.55; }
.support-tags { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }

.section-title {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.message-wrap { display: flex; }
.message-wrap-user { justify-content: flex-end; }
.message-wrap-assistant { justify-content: flex-start; }

.bubble {
  max-width: min(760px, 85%);
  border-radius: var(--radius);
  padding: 0.9rem 1rem;
  border: 1px solid var(--border);
}
.bubble-user { background: color-mix(in oklab, var(--accent) 10%, var(--bg-card)); border-color: color-mix(in oklab, var(--accent) 22%, var(--border)); }
.bubble-assistant { background: var(--bg-raised); }
.bubble-role {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}
.bubble-text { white-space: pre-wrap; line-height: 1.65; font-size: 0.88rem; }

.proposal-card, .run-card {
  width: min(860px, 100%);
  padding: 1rem;
}
.proposal-top, .run-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.proposal-label, .run-label {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.proposal-title, .run-title { margin-top: 0.3rem; font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
.proposal-desc, .run-desc { margin-top: 0.3rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.6; }
.proposal-meta + .proposal-meta { margin-top: 0.85rem; }
.proposal-meta { margin-top: 0.95rem; }
.proposal-meta-label { display: inline-block; margin-bottom: 0.45rem; color: var(--text); font-size: 0.82rem; font-weight: 700; }
.proposal-input { color: var(--text-muted); font-size: 0.84rem; line-height: 1.6; white-space: pre-wrap; }
.proposal-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 1rem;
}
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-full { grid-column: 1 / -1; }
.field-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.field-required { color: #dc2626; }
.input, .textarea {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.75rem 0.85rem;
  font: inherit;
}
.textarea { resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
.proposal-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
.confidence-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.confidence-pill-high { background: rgba(34,197,94,0.12); color: #16a34a; }
.confidence-pill-medium { background: rgba(59,130,246,0.12); color: #2563eb; }
.confidence-pill-low { background: rgba(234,179,8,0.14); color: #ca8a04; }

.check-row {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 44px;
}
.toggle { width: 18px; height: 18px; accent-color: var(--accent); }

.run-badges, .tag-row, .approval-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}
.run-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  margin-top: 0.8rem;
}
.run-meta-item { color: var(--text-muted); font-size: 0.8rem; }
.run-link { font-size: 0.82rem; font-weight: 600; color: var(--accent); text-decoration: none; }
.run-link:hover { text-decoration: underline; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.progress-headline {
  margin-top: 1rem;
  color: var(--text);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.6;
}
.progress-list { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.9rem; }
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
  padding: 0.8rem 0.9rem;
  background: var(--bg-card);
}
.progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.progress-title { font-size: 0.86rem; font-weight: 700; }
.progress-state { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
.progress-state-done { color: #16a34a; }
.progress-state-current { color: #2563eb; }
.progress-state-pending { color: #64748b; }
.progress-state-failed { color: #dc2626; }
.progress-desc { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.81rem; line-height: 1.58; }
.progress-hints {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
.progress-hints-title { margin-bottom: 0.45rem; font-size: 0.84rem; font-weight: 700; color: var(--text); }
.progress-hints-list { margin: 0; padding-left: 1.1rem; color: var(--text-muted); font-size: 0.82rem; line-height: 1.7; }

.approval-panel {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
.approval-title { margin-bottom: 0.75rem; font-size: 0.86rem; font-weight: 700; }
.approval-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
}
.approval-row + .approval-row { margin-top: 0.7rem; }
.approval-message { font-size: 0.84rem; font-weight: 600; margin-bottom: 0.45rem; }
.approval-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.btn-danger { color: #b91c1c; border-color: rgba(220,38,38,0.24); }
.btn-danger:hover { background: rgba(220,38,38,0.08); color: #b91c1c; }

.output-preview { margin-top: 1rem; }
.code-block {
  margin: 0.75rem 0 0;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  overflow: auto;
  font-size: 0.76rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.empty-state {
  min-height: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem 1.25rem;
}
.empty-title { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em; }
.empty-sub { margin-top: 0.45rem; color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; max-width: 52ch; }
.starter-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  width: 100%;
  max-width: 980px;
  margin-top: 1.3rem;
}
.starter-card {
  text-align: left;
  padding: 0.95rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.starter-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.starter-skill {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.starter-title { margin-top: 0.35rem; font-size: 0.9rem; font-weight: 700; }
.starter-prompt { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.82rem; line-height: 1.55; }

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

@media (max-width: 1100px) {
  .chat-shell { grid-template-columns: 1fr; }
  .session-panel, .composer-panel { position: static; max-height: none; }
  .starter-list { grid-template-columns: 1fr; }
}

@media (max-width: 900px) {
  .proposal-fields { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head, .support-head, .proposal-top, .run-top, .progress-top, .approval-row { flex-direction: column; }
  .chat-panel { min-height: 480px; max-height: none; }
}
</style>
