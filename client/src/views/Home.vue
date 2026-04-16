<template>
  <div class="site">
    <NavBar />
    <main class="main">
      <div class="container">

        <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

        <div v-else-if="items.length === 0" class="empty">
          <div class="empty-icon">📭</div>
          <p>暂无内容</p>
        </div>

        <template v-else>
          <!-- Hero: 首篇大图 -->
          <RouterLink :to="`/article/${items[0].slug}`" class="hero">
            <div class="hero-meta">
              <span class="tag">{{ items[0].category }}</span>
              <span class="hero-date">{{ formatDate(items[0].date) }}</span>
            </div>
            <h1 class="hero-title">{{ items[0].title }}</h1>
            <p v-if="items[0].summary" class="hero-summary">{{ items[0].summary }}</p>
            <div class="hero-tags" v-if="items[0].tags.length">
              <span v-for="t in items[0].tags.slice(0,3)" :key="t" class="tag">{{ t }}</span>
            </div>
            <span class="hero-cta">阅读全文 <span class="cta-arrow">→</span></span>
          </RouterLink>

          <!-- 分割线 + 剩余列表 -->
          <template v-if="items.length > 1">
            <div class="section-header">
              <span class="section-label">最近更新</span>
              <span class="section-count text-muted text-sm">共 {{ total }} 篇</span>
            </div>

            <div class="feed">
              <ArticleCard
                v-for="item in items.slice(1)"
                :key="item.slug"
                :item="item"
              />
            </div>
          </template>
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
import { ref, onMounted } from 'vue';
import NavBar from './NavBar.vue';
import ArticleCard from './ArticleCard.vue';
import { api } from '../api';

const items = ref([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

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
.main { padding: 2.5rem 0 5rem; }

/* ── Hero ── */
.hero {
  display: block;
  padding: 2.5rem 0 2.5rem;
  border-top: 3px solid var(--accent);
  text-decoration: none;
  color: inherit;
  margin-bottom: 0;
  transition: opacity 0.15s;
}
.hero:hover { opacity: 0.92; color: inherit; }
.hero-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.1rem;
}
.hero-date {
  font-size: 0.78rem;
  font-family: var(--font-display);
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}
.hero-title {
  font-size: clamp(1.9rem, 4vw, 3rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: var(--text);
  margin-bottom: 1rem;
  max-width: 820px;
}
.hero:hover .hero-title { color: var(--accent); }
.hero-summary {
  font-size: 1.05rem;
  color: var(--text-muted);
  line-height: 1.7;
  max-width: 680px;
  margin-bottom: 1.25rem;
}
.hero-tags { display: flex; gap: 0.4rem; margin-bottom: 1.25rem; }
.hero-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent);
}
.cta-arrow { transition: transform 0.15s; }
.hero:hover .cta-arrow { transform: translateX(4px); }

/* ── Section header ── */
.section-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0 1rem;
  border-top: 1.5px solid var(--border);
}
.section-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* ── Feed ── */
.feed { display: flex; flex-direction: column; }
</style>
