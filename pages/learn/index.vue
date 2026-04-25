<template>
  <div class="container page">
    <div class="hero">
      <div>
        <div class="hero-label">Learning</div>
        <h1 class="hero-title">学习路径</h1>
        <p class="hero-sub">管理员生成主题后，这里按本地 Markdown 索引展示并记录阅读进度。</p>
      </div>
      <NuxtLink to="/admin/learn" class="btn btn-ghost">新建主题</NuxtLink>
    </div>

    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="!topics.length" class="empty">
      <div class="empty-icon">📚</div>
      <p>还没有学习主题</p>
    </div>

    <div v-else class="topic-grid">
      <NuxtLink v-for="topic in topics" :key="topic.topic_slug" :to="`/learn/${topic.topic_slug}`" class="topic-card card">
        <div class="card-meta">
          <span class="tag">{{ topic.source_type }}</span>
          <span class="meta-time">{{ formatDate(topic.created_at) }}</span>
        </div>
        <h2 class="card-title">{{ topic.title }}</h2>
        <p v-if="topic.description" class="card-desc">{{ topic.description }}</p>
        <div class="card-stats">
          <span>{{ topic.total_chapters }} 章</span>
          <span>{{ topic.estimated_read_minutes }} 分钟</span>
          <span>{{ progressLabel(topic.topic_slug, topic.total_chapters) }}</span>
        </div>
        <div v-if="topic.tags.length" class="card-tags">
          <span v-for="tag in topic.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { LearningTopic } from '~/types/learning'

const api = useApi()
const pending = ref(true)
const topics = ref<LearningTopic[]>([])
const progressMap = ref<Record<string, number>>({})

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function loadProgress() {
  if (!import.meta.client) return
  const next: Record<string, number> = {}
  for (const topic of topics.value) next[topic.topic_slug] = readLearningProgress(topic.topic_slug).length
  progressMap.value = next
}

function progressLabel(topicSlug: string, total: number): string {
  const done = progressMap.value[topicSlug] || 0
  if (!done) return '未开始'
  if (done >= total) return `已完成 ${total}/${total}`
  return `进行中 ${done}/${total}`
}

onMounted(async () => {
  try {
    const res = await api.getLearningTopics()
    topics.value = res.topics
    loadProgress()
  } finally {
    pending.value = false
  }
})
</script>

<style scoped>
.page { padding-top: 2rem; padding-bottom: 5rem; }
.hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; padding-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); margin-bottom: 1.5rem; }
.hero-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.4rem; }
.hero-title { font-size: clamp(1.8rem, 5vw, 3rem); font-weight: 700; letter-spacing: -0.04em; }
.hero-sub { margin-top: 0.5rem; color: var(--text-muted); max-width: 620px; line-height: 1.75; }
.topic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.topic-card { display: block; padding: 1.3rem; color: inherit; text-decoration: none; transition: transform 0.15s, border-color 0.15s; }
.topic-card:hover { transform: translateY(-2px); border-color: var(--accent); color: inherit; }
.card-meta { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.8rem; }
.meta-time { color: var(--text-muted); font-size: 0.8rem; }
.card-title { font-size: 1.2rem; line-height: 1.25; margin-bottom: 0.65rem; }
.card-desc { color: var(--text-muted); line-height: 1.7; margin-bottom: 1rem; min-height: 4.7em; }
.card-stats { display: flex; gap: 0.8rem; flex-wrap: wrap; font-family: var(--font-display); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; }
.card-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }

@media (max-width: 720px) {
  .page { padding-top: 1.25rem; }
  .hero { flex-direction: column; align-items: flex-start; }
  .topic-grid { grid-template-columns: 1fr; }
  .card-desc { min-height: 0; }
}
</style>
