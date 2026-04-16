<template>
  <div class="site">
    <NavBar />
    <main class="main">
      <div class="container">
        <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

        <div v-else-if="!item" class="empty">
          <div class="empty-icon">🔍</div>
          <p>文章不存在</p>
          <RouterLink to="/" class="btn btn-ghost" style="margin-top:1.5rem">← 返回首页</RouterLink>
        </div>

        <template v-else>
          <!-- 返回 -->
          <RouterLink to="/" class="back-link">← 返回</RouterLink>

          <!-- 文章头部 -->
          <header class="article-header">
            <div class="header-meta">
              <RouterLink :to="`/category/${item.category}`" class="tag">{{ item.category }}</RouterLink>
              <time class="header-date">{{ formatDate(item.date) }}</time>
            </div>
            <h1 class="article-title">{{ item.title }}</h1>
            <p v-if="item.summary" class="article-lead">{{ item.summary }}</p>
            <div v-if="item.tags.length" class="article-tags">
              <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </header>

          <!-- 正文 -->
          <div class="article-rule" />
          <article class="article-body">
            <div class="md-content" v-html="item.content" />
          </article>

          <!-- 底部 -->
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
.main { padding: 2rem 0 5rem; }
.container { max-width: 760px; }

.back-link {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: none;
  margin-bottom: 2.5rem;
  transition: color 0.15s;
}
.back-link:hover { color: var(--accent); }

.article-header { margin-bottom: 2rem; }
.header-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}
.header-date {
  font-size: 0.8rem;
  font-family: var(--font-display);
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
.article-title {
  font-size: clamp(2rem, 5vw, 2.9rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--text);
  margin-bottom: 1.1rem;
}
.article-lead {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.75;
  margin-bottom: 1rem;
}
.article-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }

.article-rule {
  height: 2px;
  background: var(--border);
  margin-bottom: 2.5rem;
}
.article-body { margin-bottom: 3rem; }

.article-footer { padding-top: 2rem; border-top: 1px solid var(--border); }
</style>
