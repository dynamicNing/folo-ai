<template>
  <div class="site">
    <NavBar />
    <main class="main">
      <div class="container">

        <header class="cat-header">
          <div class="cat-eyebrow">分类</div>
          <h1 class="cat-title">{{ route.params.name }}</h1>
          <p v-if="!loading" class="cat-count">{{ total }} 篇内容</p>
        </header>

        <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
        <div v-else-if="items.length === 0" class="empty">
          <div class="empty-icon">📭</div>
          <p>该分类暂无内容</p>
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
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from './NavBar.vue';
import ArticleCard from './ArticleCard.vue';
import { api } from '../api';

const route = useRoute();
const items = ref([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const res = await api.getItems({ category: route.params.name, page: page.value, status: 'published' });
    items.value = res.data;
    total.value = res.total;
    totalPages.value = res.totalPages;
  } finally {
    loading.value = false;
  }
}

function go(p) { page.value = p; load(); }
onMounted(load);
watch(() => route.params.name, () => { page.value = 1; load(); });
</script>

<style scoped>
.site { min-height: 100vh; }
.main { padding: 2.5rem 0 5rem; }

.cat-header {
  padding-bottom: 2rem;
  border-bottom: 1.5px solid var(--border);
  margin-bottom: 0;
}
.cat-eyebrow {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 0.5rem;
}
.cat-title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  text-transform: capitalize;
  margin-bottom: 0.5rem;
}
.cat-count {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-family: var(--font-display);
}
.feed { display: flex; flex-direction: column; }
</style>
