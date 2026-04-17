<template>
  <div class="container" style="max-width:760px;padding-top:2rem;padding-bottom:5rem">
    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="!item" class="empty">
      <div class="empty-icon">🔍</div>
      <p>文章不存在</p>
      <NuxtLink to="/" class="btn btn-ghost" style="margin-top:1.5rem">← 返回首页</NuxtLink>
    </div>

    <template v-else>
      <NuxtLink to="/" class="back-link">← 返回</NuxtLink>

      <header class="article-header">
        <div class="header-meta">
          <NuxtLink :to="`/category/${item.category}`" class="tag">{{ item.category }}</NuxtLink>
          <time class="header-date">{{ formatDate(item.date) }}</time>
        </div>
        <h1 class="article-title">{{ item.title }}</h1>
        <p v-if="item.summary" class="article-lead">{{ item.summary }}</p>
        <div v-if="item.tags.length" class="article-tags">
          <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </header>

      <div class="article-rule" />
      <article class="article-body">
        <div class="md-content" v-html="item.content" />
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
const item = ref<Article | null>(null)
const pending = ref(true)

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  try { item.value = await api.getItem(route.params.slug as string) }
  catch { item.value = null }
  finally { pending.value = false }
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
