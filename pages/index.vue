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
  gap: 0.35rem;
  flex-wrap: wrap;
  padding: 0.5rem 0 1.25rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.type-pill {
  padding: 0.28rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-mid);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
  flex-shrink: 0;
}
.type-pill:hover { color: var(--accent); border-color: var(--accent); background: rgba(0,255,65,0.04); }
.type-pill.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(0,255,65,0.08);
  box-shadow: 0 0 8px rgba(0,255,65,0.12);
}

.hero {
  display: block;
  padding: 2rem 0;
  border-top: 1px solid var(--accent);
  text-decoration: none;
  color: inherit;
  transition: opacity 0.12s;
  position: relative;
}
.hero::before {
  content: '// FEATURED';
  position: absolute;
  top: 0.6rem;
  right: 0;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-light);
  letter-spacing: 0.1em;
}
.hero:hover { opacity: 0.9; }
.hero-meta { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem; }
.hero-date {
  font-size: 0.68rem;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.hero-title {
  font-size: clamp(1.4rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: 0.85rem;
  max-width: 820px;
  font-family: var(--font-mono);
}
.hero:hover .hero-title { color: var(--accent); }
.hero-summary {
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.7;
  max-width: 680px;
  margin-bottom: 1rem;
  font-family: var(--font-mono);
}
.hero-tags { display: flex; gap: 0.35rem; margin-bottom: 1rem; flex-wrap: wrap; }
.hero-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}
.cta-arrow { transition: transform 0.12s; }
.hero:hover .cta-arrow { transform: translateX(4px); }

.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 0 0.85rem;
  border-top: 1px solid var(--border);
}
.section-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.section-label::before { content: '> '; color: var(--accent); opacity: 0.6; }
.feed { display: flex; flex-direction: column; }

[data-theme="light"] .hero::before { display: none; }
[data-theme="light"] .type-pill:hover { color: #2355f5; border-color: #2355f5; background: transparent; }
[data-theme="light"] .type-pill.active { color: #fff; border-color: #2355f5; background: #2355f5; box-shadow: none; }
[data-theme="light"] .hero-title { font-family: var(--font-display); font-size: clamp(1.6rem, 5vw, 3rem); }
[data-theme="light"] .hero-summary { font-family: var(--font-body); font-size: 1.05rem; }
[data-theme="light"] .hero-cta { font-family: var(--font-display); }
[data-theme="light"] .section-label::before { display: none; }
[data-theme="light"] .section-label { font-family: var(--font-display); }

@media (max-width: 480px) {
  .hero { padding: 1.5rem 0; }
  .hero::before { display: none; }
  .hero-summary { font-size: 0.85rem; }
  .section-header { padding: 1rem 0 0.65rem; }
  .type-filter { padding-bottom: 0.85rem; }
}
</style>
