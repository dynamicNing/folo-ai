<template>
  <div class="container page">
    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="!topic" class="empty">
      <div class="empty-icon">🔍</div>
      <p>学习主题不存在</p>
      <NuxtLink to="/learn" class="btn btn-ghost" style="margin-top:1rem">返回列表</NuxtLink>
    </div>

    <template v-else>
      <NuxtLink to="/learn" class="back-link">← 返回学习路径</NuxtLink>

      <header class="topic-head">
        <div class="head-meta">
          <span class="tag">{{ topic.source_type }}</span>
          <span class="head-stat">{{ topic.total_chapters }} 章</span>
          <span class="head-stat">{{ topic.estimated_read_minutes }} 分钟</span>
          <span class="head-stat">{{ completedCount }}/{{ topic.total_chapters }} 已完成</span>
        </div>
        <h1 class="topic-title">{{ topic.title }}</h1>
        <p v-if="topic.description" class="topic-desc">{{ topic.description }}</p>
        <div v-if="topic.tags.length" class="topic-tags">
          <span v-for="tag in topic.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </header>

      <div class="topic-layout">
        <article class="topic-body card">
          <div class="md-content" v-html="topic.content_html" />
        </article>

        <aside class="topic-side card">
          <div class="side-label">章节目录</div>
          <div class="chapter-list">
            <NuxtLink
              v-for="chapter in topic.chapters"
              :key="chapter.chapter_slug"
              :to="`/learn/${topic.topic_slug}/${chapter.chapter_slug}`"
              class="chapter-row"
            >
              <div class="chapter-state" :class="{ done: isCompleted(chapter.chapter_slug) }">
                {{ isCompleted(chapter.chapter_slug) ? '✓' : chapter.chapter_no }}
              </div>
              <div class="chapter-main">
                <div class="chapter-title">{{ chapter.title }}</div>
                <div class="chapter-meta">{{ chapter.estimated_minutes }} 分钟</div>
              </div>
            </NuxtLink>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LearningTopicDetail } from '~/types/learning'

const route = useRoute()
const api = useApi()
const topic = ref<LearningTopicDetail | null>(null)
const pending = ref(true)
const topicSlug = computed(() => String(route.params.slug || ''))
const { completedCount, isCompleted } = useLearningProgress(topicSlug)

onMounted(async () => {
  try {
    topic.value = await api.getLearningTopic(topicSlug.value)
  } catch {
    topic.value = null
  } finally {
    pending.value = false
  }
})
</script>

<style scoped>
.page { padding-top: 2rem; padding-bottom: 5rem; }
.back-link { display: inline-flex; align-items: center; min-height: 44px; font-family: var(--font-display); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); text-decoration: none; margin-bottom: 1.5rem; }
.back-link:hover { color: var(--accent); }
.topic-head { margin-bottom: 1.5rem; }
.head-meta { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.head-stat { font-family: var(--font-display); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
.topic-title { font-size: clamp(1.7rem, 4vw, 2.8rem); line-height: 1.1; letter-spacing: -0.04em; margin-bottom: 0.8rem; }
.topic-desc { color: var(--text-muted); line-height: 1.8; max-width: 760px; margin-bottom: 0.9rem; }
.topic-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.topic-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1rem; align-items: start; }
.topic-body { padding: 1.5rem; min-width: 0; }
.topic-side { padding: 1.1rem; position: sticky; top: 76px; }
.side-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.8rem; }
.chapter-list { display: flex; flex-direction: column; gap: 0.5rem; }
.chapter-row { display: flex; gap: 0.8rem; align-items: flex-start; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius); text-decoration: none; color: inherit; transition: border-color 0.15s, background 0.15s; }
.chapter-row:hover { border-color: var(--accent); background: var(--bg-raised); color: inherit; }
.chapter-state { width: 1.9rem; height: 1.9rem; border-radius: 50%; border: 1.5px solid var(--border-mid); display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 0.8rem; font-weight: 700; color: var(--text-muted); flex-shrink: 0; }
.chapter-state.done { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
.chapter-title { font-weight: 600; line-height: 1.4; margin-bottom: 0.25rem; }
.chapter-meta { color: var(--text-muted); font-size: 0.8rem; }

@media (max-width: 960px) {
  .topic-layout { grid-template-columns: 1fr; }
  .topic-side { position: static; order: -1; }
}

@media (max-width: 640px) {
  .page { padding-top: 1.25rem; }
  .topic-body { padding: 1.1rem; }
}
</style>
