<template>
  <div class="site">
    <NavBar />
    <main class="main">
      <div class="container">
        <div class="page-header">
          <h1 class="page-title">最新内容</h1>
          <span class="text-muted text-sm">共 {{ total }} 篇</span>
        </div>

        <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

        <div v-else-if="items.length === 0" class="empty">
          <div class="empty-icon">📭</div>
          <p>暂无内容</p>
        </div>

        <div v-else class="grid">
          <ArticleCard v-for="item in items" :key="item.slug" :item="item" />
        </div>

        <div v-if="totalPages > 1" class="pagination">
          <button class="page-btn" :disabled="page <= 1" @click="go(page - 1)">← 上一页</button>
          <span class="text-muted text-sm">{{ page }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页 →</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import NavBar from './NavBar.vue';
import ArticleCard from './ArticleCard.vue';
import { api } from '../api';

const items = ref([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const res = await api.getItems({ page: page.value, status: 'published' });
    items.value = res.data;
    total.value = res.total;
    totalPages.value = res.totalPages;
  } finally {
    loading.value = false;
  }
}

function go(p) { page.value = p; load(); }

onMounted(load);
</script>

<style scoped>
.site { min-height: 100vh; }
.main { padding: 2rem 0 4rem; }
.page-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}
.page-title { font-size: 1.5rem; font-weight: 700; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}
@media (max-width: 640px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
