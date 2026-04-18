<template>
  <div class="container" style="padding-top:1.5rem;padding-bottom:5rem">
    <!-- 类型筛选 -->
    <div class="type-filter" role="tablist">
      <button
        class="type-pill"
        :class="{ active: selected === '' }"
        role="tab"
        :aria-selected="selected === ''"
        @click="select('')"
      >全部</button>
      <button
        v-for="c in categories"
        :key="c"
        class="type-pill"
        :class="{ active: selected === c }"
        role="tab"
        :aria-selected="selected === c"
        @click="select(c)"
      >{{ c }}</button>
    </div>

    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="!items.length" class="empty">
      <div class="empty-icon">📭</div>
      <p>暂无内容</p>
    </div>

    <template v-else>
      <NuxtLink :to="`/article/${items[0].slug}`" class="hero">
        <div class="hero-meta">
          <span class="tag">{{ items[0].category }}</span>
          <span class="hero-date">{{ formatDate(items[0].date) }}</span>
        </div>
        <h1 class="hero-title">{{ items[0].title }}</h1>
        <p v-if="items[0].summary" class="hero-summary">{{ items[0].summary }}</p>
        <div v-if="items[0].tags.length" class="hero-tags">
          <span v-for="t in items[0].tags.slice(0, 3)" :key="t" class="tag">{{ t }}</span>
        </div>
        <span class="hero-cta">阅读全文 <span class="cta-arrow">→</span></span>
      </NuxtLink>

      <template v-if="items.length > 1">
        <div class="section-header">
          <span class="section-label">最近更新</span>
          <span class="section-count text-muted text-sm">共 {{ total }} 篇</span>
        </div>
        <div class="feed">
          <ArticleCard v-for="item in items.slice(1)" :key="item.slug" :item="item" />
        </div>
      </template>
    </template>

    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="go(page - 1)">← 上一页</button>
      <span class="text-muted text-sm">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Article } from '~/types/article'

const api = useApi()
const items = ref<Article[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const pending = ref(true)
const categories = ref<string[]>([])
const selected = ref<string>('')

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function load() {
  pending.value = true
  try {
    const res = await api.getItems({
      page: page.value,
      status: 'published',
      category: selected.value || undefined,
    })
    items.value = res.data
    total.value = res.total
    totalPages.value = res.totalPages
  } finally { pending.value = false }
}

function go(p: number) { page.value = p; load() }

function select(c: string) {
  if (selected.value === c) return
  selected.value = c
  page.value = 1
  load()
}

onMounted(async () => {
  try { categories.value = await api.getCategories() } catch {}
  await load()
})
</script>

<style scoped>
.type-filter {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.25rem 0 1.5rem;
  border-bottom: 1.5px solid var(--border);
  margin-bottom: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.type-pill {
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  border: 1.5px solid var(--border-mid);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.type-pill:hover { color: var(--text); border-color: var(--text-muted); }
.type-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.hero { display: block; padding: 2.5rem 0; border-top: 3px solid var(--accent); text-decoration: none; color: inherit; transition: opacity 0.15s; }
.hero:hover { opacity: 0.92; color: inherit; }
.hero-meta { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.1rem; }
.hero-date { font-size: 0.78rem; font-family: var(--font-display); font-weight: 500; color: var(--text-muted); letter-spacing: 0.03em; }
.hero-title { font-size: clamp(1.6rem, 5vw, 3rem); font-weight: 700; line-height: 1.15; letter-spacing: -0.03em; color: var(--text); margin-bottom: 1rem; max-width: 820px; }
.hero:hover .hero-title { color: var(--accent); }
.hero-summary { font-size: 1.05rem; color: var(--text-muted); line-height: 1.7; max-width: 680px; margin-bottom: 1.25rem; }
.hero-tags { display: flex; gap: 0.4rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.hero-cta { display: inline-flex; align-items: center; gap: 0.3em; font-family: var(--font-display); font-size: 0.85rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--accent); }
.cta-arrow { transition: transform 0.15s; }
.hero:hover .cta-arrow { transform: translateX(4px); }

.section-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.5rem 0 1rem; border-top: 1.5px solid var(--border); }
.section-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
.feed { display: flex; flex-direction: column; }

@media (max-width: 480px) {
  .hero { padding: 1.5rem 0; }
  .hero-summary { font-size: 0.95rem; }
  .section-header { padding: 1.25rem 0 0.75rem; }
  .type-filter { padding-bottom: 1rem; }
}
</style>
