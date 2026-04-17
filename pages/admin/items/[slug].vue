<template>
  <div class="page">
    <div class="page-head">
      <button class="back-btn" @click="router.back()">← 返回</button>
      <template v-if="item">
        <div class="head-meta">
          <span class="tag">{{ item.category }}</span>
          <span :class="`badge badge-${item.status}`">{{ statusLabel(item.status) }}</span>
          <span class="head-date text-muted text-sm">{{ formatDate(item.date) }}</span>
          <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
        <h1 class="page-title">{{ item.title }}</h1>
      </template>
    </div>

    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="!item" class="empty">
      <div class="empty-icon">🔍</div><p>文章不存在</p>
    </div>
    <div v-else class="preview-box">
      <div class="md-content" v-html="item.content" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import type { Article, ArticleStatus } from '~/types/article'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const api = useApi()
const item = ref<Article | null>(null)
const pending = ref(true)

function statusLabel(s: ArticleStatus): string {
  return ({ published: '已发布', draft: '草稿', archived: '已归档' } as const)[s] || s
}

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(async () => {
  try { item.value = await api.getItem(route.params.slug as string, auth.authHeader()) }
  catch { item.value = null }
  finally { pending.value = false }
})
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; max-width: 880px; }
.page-head { margin-bottom: 1.75rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.back-btn { background: none; border: none; font-family: var(--font-display); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); cursor: pointer; padding: 0; margin-bottom: 1rem; transition: color 0.15s; }
.back-btn:hover { color: var(--accent); }
.head-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
.page-title { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
.preview-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 2.5rem; box-shadow: var(--shadow); }
@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .preview-box { padding: 1.25rem; }
  .page-title { font-size: 1.25rem; }
  .back-btn { min-height: 44px; display: flex; align-items: center; }
}
</style>
