<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">学习拆解</h1>
        <p class="page-sub">输入主题后，服务端生成 Markdown 并立即刷新学习索引。</p>
      </div>
    </div>

    <div class="panel card">
      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">学习主题</span>
          <input v-model.trim="form.topic" class="input" placeholder="例如：深入理解 Linux 内核" />
        </label>

        <div class="field-grid">
          <label class="field">
            <span class="field-label">主题类型</span>
            <select v-model="form.source_type" class="select">
              <option value="book">书籍</option>
              <option value="concept">概念</option>
              <option value="skill">技能</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">生成深度</span>
            <select v-model="form.depth" class="select">
              <option value="brief">Brief · 5-6 章</option>
              <option value="standard">Standard · 10-14 章</option>
              <option value="deep">Deep · 18-22 章</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span class="field-label">补充上下文</span>
          <textarea
            v-model.trim="form.context"
            class="textarea"
            rows="5"
            placeholder="作者、版本、希望覆盖的重点、已有基础等"
          />
        </label>

        <div class="actions">
          <button class="btn btn-primary" :disabled="pending">
            {{ pending ? '生成中...' : '开始生成' }}
          </button>
          <span class="hint">阻塞式生成，完成后直接写入本地 `content-archive/learning`。</span>
        </div>
      </form>
    </div>

    <div v-if="error" class="notice notice-error">{{ error }}</div>

    <div v-if="result" class="result card">
      <div class="result-head">
        <div>
          <div class="result-label">生成完成</div>
          <h2 class="result-title">{{ result.title }}</h2>
        </div>
        <NuxtLink :to="`/learn/${result.slug}`" class="btn btn-ghost" target="_blank">查看主题</NuxtLink>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-num">{{ result.total_chapters }}</div>
          <div class="stat-label">章节数</div>
        </div>
        <div class="stat">
          <div class="stat-num">{{ result.estimated_read_minutes }}</div>
          <div class="stat-label">预计分钟</div>
        </div>
      </div>

      <div class="result-files">
        <div class="field-label">写入文件</div>
        <ul class="file-list">
          <li v-for="file in result.files_written" :key="file">{{ file }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import type { LearningDepth, LearningGenerateResponse, LearningSourceType } from '~/types/learning'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const api = useApi()
const auth = useAuthStore()
const pending = ref(false)
const error = ref('')
const result = ref<LearningGenerateResponse | null>(null)
const form = ref<{
  topic: string
  source_type: LearningSourceType
  depth: LearningDepth
  context: string
}>({
  topic: '',
  source_type: 'book',
  depth: 'standard',
  context: '',
})

async function submit() {
  if (!form.value.topic.trim()) {
    error.value = '请输入学习主题'
    return
  }

  pending.value = true
  error.value = ''

  try {
    result.value = await api.generateLearningTopic({
      topic: form.value.topic,
      source_type: form.value.source_type,
      depth: form.value.depth,
      context: form.value.context,
    }, auth.authHeader())
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; max-width: 960px; }
.page-head { margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; }
.panel { padding: 1.4rem; }
.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.45rem; }
.field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.field-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.input, .select, .textarea {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.8rem 0.9rem;
  font: inherit;
  outline: none;
}
.input:focus, .select:focus, .textarea:focus { border-color: var(--accent); }
.textarea { resize: vertical; min-height: 120px; }
.actions { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; }
.hint { color: var(--text-muted); font-size: 0.84rem; }
.notice { margin-top: 1rem; padding: 0.9rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.notice-error { color: #b91c1c; background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.18); }
.result { margin-top: 1rem; padding: 1.4rem; }
.result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.result-label { font-family: var(--font-display); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.3rem; }
.result-title { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.02em; }
.stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 1.25rem; }
.stat { background: var(--bg-card); padding: 1rem 1.2rem; }
.stat-num { font-family: var(--font-display); font-size: 1.7rem; font-weight: 700; color: var(--accent); line-height: 1; margin-bottom: 0.3rem; }
.stat-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.file-list { margin-top: 0.6rem; padding-left: 1.2rem; color: var(--text-muted); }
.file-list li { margin: 0.35rem 0; word-break: break-all; }

@media (max-width: 720px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .field-grid { grid-template-columns: 1fr; }
  .result-head { flex-direction: column; }
}
</style>
