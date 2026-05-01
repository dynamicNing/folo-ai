<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Skill Chat</h1>
        <p class="page-sub">通过自然语言直接调用 skill，会话自动保存在服务端，支持跨浏览器/跨设备同步。</p>
      </div>
      <NuxtLink to="/admin/skills" class="btn btn-ghost">查看 Skills</NuxtLink>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>

    <template v-else>
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
            <div v-for="(message, index) in messages" :key="index" class="message-wrap" :class="`message-wrap-${message.role}`">
              <div class="bubble" :class="`bubble-${message.role}`">
                <div class="bubble-role">{{ message.role === 'user' ? '你' : 'Assistant' }}</div>
                <div class="bubble-text">{{ message.content }}</div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="empty-state">
              <div class="empty-title">开始对话</div>
              <p class="empty-sub">直接用自然语言描述需求，AI 会自动匹配并执行对应的 skill。</p>
            </div>
          </template>
        </section>

        <form class="card composer-panel" @submit.prevent="submitPrompt">
          <div class="composer-toolbar">
            <label class="skill-picker">
              <span class="section-title">Skill</span>
              <select v-model="selectedSkillSlug" class="skill-select" :disabled="submitting || !availableSkills.length">
                <option value="">自动选择</option>
                <option v-for="skill in availableSkills" :key="skill.slug" :value="skill.slug">{{ skill.name }}</option>
              </select>
            </label>
            <span class="selected-skill-note">
              {{ selectedSkill ? selectedSkill.description : '让模型从可用内置 skill 中自动匹配。' }}
            </span>
          </div>

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
              {{ submitting ? '处理中...' : '发送' }}
            </button>
            <button class="btn btn-ghost" type="button" :disabled="submitting || !composer" @click="composer = ''">清空</button>
            <span class="composer-hint">`Ctrl/Cmd + Enter` 发送</span>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { SkillChatSessionRecord as SkillChatSessionRemoteRecord } from '~/types/skillChat'
import type { SkillDefinitionSummary } from '~/types/skill'

definePageMeta({ layout: 'admin', middleware: 'auth' })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

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

const api = useApi()
const loading = ref(false)
const error = ref('')
const sessionError = ref('')
const submitting = ref(false)
const composer = ref('')
const selectedSkillSlug = ref('')
const messages = ref<ChatMessage[]>([])
const sessions = ref<ChatSessionRecord[]>([])
const availableSkills = ref<SkillDefinitionSummary[]>([])
const currentSessionId = ref('')
const messageViewport = ref<HTMLElement | null>(null)
let sessionsReady = false

const selectedSkill = computed(() =>
  availableSkills.value.find(skill => skill.slug === selectedSkillSlug.value) || null
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

function truncateText(value: string, limit = 36): string {
  const text = value.trim()
  if (!text) return ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function sessionTitleFromMessages(list: ChatMessage[]): string {
  for (const message of list) {
    if (message.role === 'user' && message.content.trim()) {
      return truncateText(message.content, 24)
    }
  }
  return '新会话'
}

function sessionPreview(list: ChatMessage[]): string {
  const last = list[list.length - 1]
  if (!last) return '还没有消息'
  return truncateText(last.content, 44) || '消息'
}

function sortSessions(list: ChatSessionRecord[]): ChatSessionRecord[] {
  return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function upsertSession(session: ChatSessionRecord): void {
  const rest = sessions.value.filter(item => item.id !== session.id)
  sessions.value = sortSessions([session, ...rest])
}

function reviveStoredMessages(list: unknown): ChatMessage[] {
  if (!Array.isArray(list)) return []
  return list.map((item: any) => ({
    role: item.role === 'user' ? 'user' : 'assistant',
    content: typeof item.content === 'string' ? item.content : item.text || '',
  }))
}

function normalizeServerSession(session: SkillChatSessionRemoteRecord): ChatSessionRecord {
  const revivedMessages = reviveStoredMessages(session.messages)
  return {
    id: session.id,
    title: session.title || sessionTitleFromMessages(revivedMessages),
    preview: session.preview || sessionPreview(revivedMessages),
    messageCount: session.messageCount,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: revivedMessages,
  }
}

function applySession(session: ChatSessionRecord): void {
  currentSessionId.value = session.id
  messages.value = [...session.messages]
  queueScrollToBottom()
}

function queueScrollToBottom(): void {
  nextTick(() => {
    const el = messageViewport.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  })
}

async function saveCurrentSessionNow(sessionId = currentSessionId.value): Promise<boolean> {
  if (!sessionsReady || !sessionId) return true
  const existing = sessions.value.find(session => session.id === sessionId)
  if (!existing) return true

  const snapshot = sessionId === currentSessionId.value ? messages.value : existing.messages

  upsertSession({
    ...existing,
    title: sessionTitleFromMessages(snapshot),
    preview: sessionPreview(snapshot),
    messageCount: snapshot.length,
    messages: snapshot,
    updatedAt: new Date().toISOString(),
  })

  try {
    await api.updateSkillChatSession(sessionId, {
      title: sessionTitleFromMessages(snapshot),
      preview: sessionPreview(snapshot),
      messageCount: snapshot.length,
      messages: snapshot,
    })
    sessionError.value = ''
    return true
  } catch (err) {
    sessionError.value = (err as Error).message
    return false
  }
}

async function createNewSession(): Promise<void> {
  sessionError.value = ''
  if (currentSessionId.value) await saveCurrentSessionNow()
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
  await saveCurrentSessionNow()
  const target = sessions.value.find(session => session.id === sessionId)
  if (!target) return
  applySession(target)
}

async function deleteSession(sessionId: string): Promise<void> {
  const target = sessions.value.find(session => session.id === sessionId)
  if (!target) return
  if (!window.confirm(`删除会话"${target.title}"？`)) return

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
      currentSessionId.value = ''
      messages.value = []
    }
    await createNewSession()
    return
  }

  if (deletingCurrent) {
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

async function loadAvailableSkills(): Promise<void> {
  const response = await api.getSkills({ source_origin: 'builtin', status: 'active' })
  availableSkills.value = response.data
    .filter(skill => skill.source_origin === 'builtin' && skill.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

function pushMessage(message: ChatMessage): void {
  messages.value = [...messages.value, message]
  queueScrollToBottom()
}

async function submitPrompt(): Promise<void> {
  const text = composer.value.trim()
  if (!text || submitting.value) return

  submitting.value = true
  composer.value = ''
  pushMessage({ role: 'user', content: text })

  try {
    const { reply } = await $fetch<{ reply: string }>('/api/skill-chat/chat', {
      method: 'POST',
      body: {
        session_id: currentSessionId.value,
        message: text,
        skill_slug: selectedSkillSlug.value || undefined,
      },
    })

    pushMessage({ role: 'assistant', content: reply })
    await saveCurrentSessionNow()
  } catch (err) {
    pushMessage({ role: 'assistant', content: `错误：${(err as Error).message}` })
  } finally {
    submitting.value = false
  }
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  if (!(event.metaKey || event.ctrlKey)) return
  event.preventDefault()
  submitPrompt()
}

function formatSessionTime(value: string): string {
  const date = new Date(value)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString('zh-CN')
}

watch(messages, () => {
  if (sessionsReady && currentSessionId.value) {
    const existing = sessions.value.find(s => s.id === currentSessionId.value)
    if (existing) {
      upsertSession({
        ...existing,
        title: sessionTitleFromMessages(messages.value),
        preview: sessionPreview(messages.value),
        messageCount: messages.value.length,
        messages: messages.value,
        updatedAt: new Date().toISOString(),
      })
    }
  }
})

loading.value = true
Promise.all([loadAvailableSkills(), loadSessionsFromServer()])
  .then(() => {
    sessionsReady = true
  })
  .catch(err => {
    error.value = (err as Error).message
  })
  .finally(() => {
    loading.value = false
  })
</script>

<style scoped>
.page { padding: 1.5rem; max-width: 1600px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; }
.page-title { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.03em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.88rem; line-height: 1.6; max-width: 68ch; }

.loading, .notice { padding: 1.5rem; text-align: center; }
.loading { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
.spinner { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.notice-error { background: rgba(220,38,38,0.08); color: #b91c1c; border: 1px solid rgba(220,38,38,0.24); border-radius: var(--radius); }

.chat-shell { display: grid; grid-template-columns: 280px 1fr; grid-template-rows: 1fr auto; gap: 1rem; height: calc(100vh - 180px); }
.session-panel { grid-row: 1 / 3; display: flex; flex-direction: column; overflow: hidden; }
.session-panel-head { padding: 1rem; border-bottom: 1px solid var(--border); }
.section-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
.session-sub { margin-top: 0.25rem; font-size: 0.76rem; color: var(--text-muted); line-height: 1.5; }
.session-error { margin: 0.75rem; font-size: 0.8rem; }

.session-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.session-item {
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 0.4rem;
}
.session-item:hover { background: var(--bg-raised); }
.session-item-active { background: var(--bg-raised); border-left: 3px solid var(--accent); }
.session-item-top { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.session-title { font-size: 0.84rem; font-weight: 600; flex: 1; }
.session-delete {
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s;
}
.session-item:hover .session-delete { opacity: 1; }
.session-delete:hover { color: #b91c1c; }
.session-preview { margin-top: 0.3rem; font-size: 0.76rem; color: var(--text-muted); line-height: 1.4; }
.session-meta { margin-top: 0.4rem; display: flex; gap: 0.75rem; font-size: 0.72rem; color: var(--text-muted); }

.chat-panel { overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; color: var(--text); }
.message-wrap { display: flex; }
.message-wrap-user { justify-content: flex-end; }
.message-wrap-assistant { justify-content: flex-start; }
.bubble {
  max-width: 75%;
  padding: 0.85rem 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  color: var(--text);
}
.bubble-user { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }
.bubble-assistant { background: var(--bg-card); }
.bubble-role { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; opacity: 0.7; }
.bubble-text { font-size: 0.88rem; line-height: 1.6; white-space: pre-wrap; }

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

.composer-panel { padding: 1rem; }
.composer-toolbar { display: flex; align-items: flex-end; gap: 0.9rem; margin-bottom: 0.9rem; }
.skill-picker { display: flex; flex-direction: column; gap: 0.5rem; min-width: 220px; }
.skill-select {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  font: inherit;
}
.skill-select:focus, .composer-input:focus {
  outline: none;
  border-color: var(--accent);
}
.skill-select:disabled { opacity: 0.55; cursor: not-allowed; }
.selected-skill-note {
  flex: 1;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
  padding-bottom: 0.55rem;
}
.composer-field { display: block; }
.composer-input {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
  caret-color: var(--accent);
  font-family: inherit;
  font-size: 0.88rem;
  line-height: 1.6;
  resize: vertical;
}
.composer-input::placeholder { color: var(--text-muted); }
.composer-actions { margin-top: 0.75rem; display: flex; align-items: center; gap: 0.75rem; }
.composer-hint { margin-left: auto; font-size: 0.76rem; color: var(--text-muted); }

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover { background: var(--bg-raised); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #000; border-color: var(--accent); }
.btn-primary:hover { opacity: 0.9; }
.btn-ghost { background: transparent; }
.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }

@media (max-width: 1024px) {
  .chat-shell { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; height: auto; }
  .session-panel { grid-row: 1; max-height: 200px; }
  .composer-toolbar { align-items: stretch; flex-direction: column; }
  .skill-picker { min-width: 0; }
  .selected-skill-note { padding-bottom: 0; }
}
</style>
