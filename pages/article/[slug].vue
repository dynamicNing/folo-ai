<template>
  <div class="container" style="max-width:760px;padding-top:2rem;padding-bottom:5rem">
    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="!meta" class="empty">
      <div class="empty-icon">🔍</div>
      <p>文章不存在</p>
      <NuxtLink to="/" class="btn btn-ghost" style="margin-top:1.5rem">← 返回首页</NuxtLink>
    </div>

    <template v-else>
      <NuxtLink to="/" class="back-link">← 返回</NuxtLink>

      <header class="article-header">
        <div class="header-meta">
          <NuxtLink :to="`/category/${meta.category}`" class="tag">{{ meta.category }}</NuxtLink>
          <time class="header-date">{{ formatDate(meta.date) }}</time>
        </div>
        <h1 class="article-title">{{ meta.title }}</h1>
        <p v-if="meta.summary" class="article-lead">{{ meta.summary }}</p>
        <div v-if="meta.tags.length" class="article-tags">
          <span v-for="tag in meta.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </header>

      <div class="article-rule" />
      <article class="article-body">
        <ContentRenderer v-if="doc" :value="doc" class="md-content" />
        <div v-else class="md-content" v-html="meta.content" />
      </article>

      <div class="article-footer">
        <NuxtLink to="/" class="btn btn-ghost">← 返回列表</NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Article } from '~/types/article'

const route = useRoute()
const api = useApi()
const meta = ref<Article | null>(null)
const doc = ref<unknown>(null)
const pending = ref(true)

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  const slug = route.params.slug as string
  try {
    const [m, d] = await Promise.all([
      api.getItem(slug).catch(() => null),
      queryCollection('archive').path(`/${slug}`).first().catch(() => null),
    ])
    meta.value = m
    doc.value = d
  } finally {
    pending.value = false
  }
})
</script>

<style scoped>
.back-link { display: inline-flex; align-items: center; min-height: 44px; font-family: var(--font-display); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); text-decoration: none; margin-bottom: 2rem; transition: color 0.15s; }
.back-link:hover { color: var(--accent); }
.article-header { margin-bottom: 2rem; }
.header-meta { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
.header-date { font-size: 0.8rem; font-family: var(--font-display); font-weight: 500; color: var(--text-muted); letter-spacing: 0.02em; }
.article-title { font-size: clamp(1.6rem, 5vw, 2.9rem); font-weight: 700; line-height: 1.15; letter-spacing: -0.03em; color: var(--text); margin-bottom: 1.1rem; }
.article-lead { font-size: 1.05rem; color: var(--text-muted); line-height: 1.75; margin-bottom: 1rem; }
.article-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.article-rule { height: 2px; background: var(--border); margin-bottom: 2.5rem; }
.article-body { margin-bottom: 3rem; }
.article-footer { padding-top: 2rem; border-top: 1px solid var(--border); }

@media (max-width: 480px) {
  .back-link { margin-bottom: 1.25rem; }
  .article-header { margin-bottom: 1.25rem; }
  .article-rule { margin-bottom: 1.5rem; }
  .article-lead { font-size: 0.95rem; }
}
</style>
