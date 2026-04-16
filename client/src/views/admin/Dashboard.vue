<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">概览</h1>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

    <template v-else>
      <div class="stats-grid">
        <div class="stat-card card" v-for="s in stats" :key="s.label">
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-label text-muted text-sm">{{ s.label }}</div>
        </div>
      </div>

      <div class="recent-section">
        <h2 class="section-title">最近发布</h2>
        <div class="recent-list">
          <RouterLink
            v-for="item in recent"
            :key="item.slug"
            :to="`/admin/items/${item.slug}`"
            class="recent-item card"
          >
            <div class="recent-meta">
              <span class="tag">{{ item.category }}</span>
              <span :class="`badge badge-${item.status}`">{{ statusLabel(item.status) }}</span>
            </div>
            <div class="recent-title">{{ item.title }}</div>
            <div class="recent-date text-muted text-sm">{{ formatDate(item.date) }}</div>
          </RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api';

const auth = useAuthStore();
const allItems = ref([]);
const loading = ref(true);

const stats = computed(() => {
  const all = allItems.value;
  return [
    { label: '全部内容', value: all.length },
    { label: '已发布', value: all.filter(i => i.status === 'published').length },
    { label: '草稿', value: all.filter(i => i.status === 'draft').length },
    { label: '已归档', value: all.filter(i => i.status === 'archived').length },
  ];
});

const recent = computed(() =>
  allItems.value.filter(i => i.status === 'published').slice(0, 5)
);

function statusLabel(s) {
  return { published: '已发布', draft: '草稿', archived: '已归档' }[s] || s;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

onMounted(async () => {
  try {
    // 管理员拉取全部状态
    const [pub, draft, arch] = await Promise.all([
      api.getItems({ status: 'published', pageSize: 100, ...{ headers: auth.authHeader() } }),
      api.getItems({ status: 'draft', pageSize: 100 }),
      api.getItems({ status: 'archived', pageSize: 100 }),
    ]);
    allItems.value = [...pub.data, ...draft.data, ...arch.data];
    allItems.value.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { margin-bottom: 1.75rem; }
.page-title { font-size: 1.5rem; font-weight: 700; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
.stat-card { padding: 1.25rem; text-align: center; }
.stat-value { font-size: 2rem; font-weight: 700; color: var(--accent); }
.stat-label { margin-top: 0.25rem; }
.section-title { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
.recent-list { display: flex; flex-direction: column; gap: 0.75rem; }
.recent-item {
  display: block;
  padding: 1rem 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s;
}
.recent-item:hover { transform: translateX(3px); }
.recent-meta { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
.recent-title { font-weight: 500; margin-bottom: 0.25rem; }
.recent-date {}
@media (max-width: 640px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
