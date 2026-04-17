<template>
  <div class="container" style="padding-top:2.5rem;padding-bottom:5rem">
    <header class="cat-header">
      <div class="cat-eyebrow">分类</div>
      <h1 class="cat-title">{{ route.params.name }}</h1>
      <p v-if="!pending" class="cat-count">{{ total }} 篇内容</p>
    </header>

    <div v-if="pending" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="!items.length" class="empty">
      <div class="empty-icon">📭</div><p>该分类暂无内容</p>
    </div>
    <template v-else>
      <div class="feed">
        <ArticleCard v-for="item in items" :key="item.slug" :item="item" />
      </div>
    </template>

    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="go(page - 1)">← 上一页</button>
      <span class="text-muted text-sm">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Article } from '~/types/article'

const route = useRoute()
const api = useApi()
const items = ref<Article[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const pending = ref(true)

async function load() {
  pending.value = true
  try {
    const res = await api.getItems({
      category: route.params.name as string,
      page: page.value,
      status: 'published',
    })
    items.value = res.data
    total.value = res.total
    totalPages.value = res.totalPages
  } finally { pending.value = false }
}

function go(p: number) { page.value = p; load() }
onMounted(load)
watch(() => route.params.name, () => { page.value = 1; load() })
</script>

<style scoped>
.cat-header { padding-bottom: 2rem; border-bottom: 1.5px solid var(--border); }
.cat-eyebrow { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.5rem; }
.cat-title { font-size: clamp(1.6rem, 5vw, 3rem); font-weight: 700; letter-spacing: -0.03em; text-transform: capitalize; margin-bottom: 0.5rem; }
.cat-count { font-size: 0.875rem; color: var(--text-muted); font-family: var(--font-display); }
.feed { display: flex; flex-direction: column; }

@media (max-width: 480px) {
  .cat-header { padding-bottom: 1.25rem; }
}
</style>
