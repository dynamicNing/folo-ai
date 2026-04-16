<template>
  <div class="site">
    <NavBar />
    <main class="main">
      <div class="container">
        <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

        <div v-else-if="!item" class="empty">
          <div class="empty-icon">🔍</div>
          <p>文章不存在</p>
          <RouterLink to="/" class="btn btn-ghost" style="margin-top:1rem">← 返回首页</RouterLink>
        </div>

        <template v-else>
          <div class="article-header">
            <div class="header-meta">
              <RouterLink :to="`/category/${item.category}`" class="tag">{{ item.category }}</RouterLink>
              <span class="text-muted text-sm">{{ formatDate(item.date) }}</span>
            </div>
            <h1 class="article-title">{{ item.title }}</h1>
            <p v-if="item.summary" class="article-summary">{{ item.summary }}</p>
            <div v-if="item.tags.length" class="article-tags">
              <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <div class="article-body card">
            <div class="md-content" v-html="item.content" />
          </div>

          <div class="article-footer">
            <RouterLink to="/" class="btn btn-ghost">← 返回列表</RouterLink>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import NavBar from './NavBar.vue';
import { api } from '../api';

const route = useRoute();
const item = ref(null);
const loading = ref(true);

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

onMounted(async () => {
  try {
    item.value = await api.getItem(route.params.slug);
  } catch {
    item.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.site { min-height: 100vh; }
.main { padding: 2rem 0 4rem; }
.container { max-width: 800px; }
.article-header { margin-bottom: 2rem; }
.header-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}
.article-title {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}
.article-summary {
  font-size: 1.05rem;
  color: var(--text-muted);
  line-height: 1.7;
  margin-bottom: 0.75rem;
}
.article-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.article-body { padding: 2rem; }
.article-footer { margin-top: 2rem; }
@media (max-width: 640px) {
  .article-title { font-size: 1.5rem; }
  .article-body { padding: 1.25rem; }
}
</style>
