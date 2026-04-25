<template>
  <div class="container page">
    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="!chapter" class="empty">
      <div class="empty-icon">🔍</div>
      <p>章节不存在</p>
      <NuxtLink to="/learn" class="btn btn-ghost" style="margin-top:1rem">返回列表</NuxtLink>
    </div>

    <template v-else>
      <div class="topbar">
        <NuxtLink :to="`/learn/${chapter.topic.topic_slug}`" class="back-link">← 返回目录</NuxtLink>
        <div class="nav-links">
          <NuxtLink
            v-if="chapter.prev_chapter"
            :to="`/learn/${chapter.topic.topic_slug}/${chapter.prev_chapter.chapter_slug}`"
            class="btn btn-ghost btn-sm"
          >上一章</NuxtLink>
          <NuxtLink
            v-if="chapter.next_chapter"
            :to="`/learn/${chapter.topic.topic_slug}/${chapter.next_chapter.chapter_slug}`"
            class="btn btn-ghost btn-sm"
          >下一章</NuxtLink>
        </div>
      </div>

      <header class="chapter-head">
        <div class="head-meta">
          <span class="tag">Chapter {{ chapter.chapter_no }}</span>
          <span class="head-stat">{{ chapter.estimated_minutes }} 分钟</span>
          <span class="head-stat">{{ isCompleted(chapter.chapter_slug) ? '已完成' : '未完成' }}</span>
        </div>
        <h1 class="chapter-title">{{ chapter.title }}</h1>
        <p class="chapter-topic">{{ chapter.topic.title }}</p>
        <button
          class="complete-btn"
          :class="{ done: isCompleted(chapter.chapter_slug) }"
          @click="toggleChapterCompleted(chapter.chapter_slug)"
        >
          {{ isCompleted(chapter.chapter_slug) ? '取消完成' : '标记本章已完成' }}
        </button>
      </header>

      <article class="chapter-body card">
        <div class="md-content" v-html="chapter.content_html" />
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { LearningChapterDetail } from '~/types/learning'

const route = useRoute()
const api = useApi()
const pending = ref(true)
const chapter = ref<LearningChapterDetail | null>(null)
const topicSlug = computed(() => String(route.params.slug || ''))
const chapterSlug = computed(() => String(route.params.chapter || ''))
const { isCompleted, toggleChapterCompleted } = useLearningProgress(topicSlug)

async function load() {
  pending.value = true
  try {
    chapter.value = await api.getLearningChapter(topicSlug.value, chapterSlug.value)
  } catch {
    chapter.value = null
  } finally {
    pending.value = false
  }
}

watch([topicSlug, chapterSlug], load, { immediate: true })
</script>

<style scoped>
.page { max-width: 860px; padding-top: 2rem; padding-bottom: 5rem; }
.topbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; }
.back-link { display: inline-flex; align-items: center; min-height: 44px; font-family: var(--font-display); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); text-decoration: none; }
.back-link:hover { color: var(--accent); }
.nav-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.chapter-head { margin-bottom: 1.25rem; }
.head-meta { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.head-stat { font-family: var(--font-display); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); }
.chapter-title { font-size: clamp(1.6rem, 4vw, 2.7rem); line-height: 1.12; letter-spacing: -0.04em; margin-bottom: 0.45rem; }
.chapter-topic { color: var(--text-muted); margin-bottom: 1rem; }
.complete-btn {
  border: 1.5px solid var(--border-mid);
  background: transparent;
  color: var(--text);
  border-radius: var(--radius);
  padding: 0.65rem 1rem;
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
}
.complete-btn:hover { border-color: var(--accent); color: var(--accent); }
.complete-btn.done { border-color: var(--accent); background: var(--accent-subtle); color: var(--accent); }
.chapter-body { padding: 1.5rem; }

@media (max-width: 640px) {
  .page { padding-top: 1.25rem; }
  .topbar { flex-direction: column; align-items: flex-start; }
  .chapter-body { padding: 1.1rem; }
}
</style>
