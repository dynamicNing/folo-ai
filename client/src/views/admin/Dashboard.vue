<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">概览</h1>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

    <template v-else>
      <div class="stats-row">
        <div class="stat" v-for="s in stats" :key="s.label">
          <div class="stat-num">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-head">最近发布</div>
        <div class="recent-list">
          <RouterLink
            v-for="item in recent"
            :key="item.slug"
            :to="`/admin/items/${item.slug}`"
            class="recent-row"
          >
            <div class="recent-left">
              <div class="recent-meta">
                <span class="tag">{{ item.category }}</span>
                <span :class="`badge badge-${item.status}`">{{ statusLabel(item.status) }}</span>
              </div>
              <div class="recent-title">{{ item.title }}</div>
            </div>
            <div class="recent-date text-muted text-sm">{{ formatDate(item.date) }}</div>
          </RouterLink>
          <div v-if="recent.length === 0" class="empty" style="padding:2rem">
            <p>暂无已发布内容</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { api } from '../../api';

const allItems = ref([]);
const loading = ref(true);

const stats = computed(() => {
  const all = allItems.value;
  return [
    { label: '全部', value: all.length },
    { label: '已发布', value: all.filter(i => i.status === 'published').length },
    { label: '草稿', value: all.filter(i => i.status === 'draft').length },
    { label: '已归档', value: all.filter(i => i.status === 'archived').length },
  ];
});
const recent = computed(() =>
  allItems.value.filter(i => i.status === 'published').slice(0, 6)
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
    const [pub, draft, arch] = await Promise.all([
      api.getItems({ status: 'published', pageSize: 100 }),
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
.page { padding: 2rem 2rem 4rem; }
.page-head { margin-bottom: 2rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 2.5rem;
}
.stat {
  background: var(--bg-card);
  padding: 1.5rem 1.25rem;
  text-align: center;
}
.stat-num {
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.04em;
  color: var(--accent);
  line-height: 1;
  margin-bottom: 0.4rem;
}
.stat-label {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.section { }
.section-head {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 0.75rem;
}
.recent-list {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  overflow: hidden;
}
.recent-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
}
.recent-row:last-child { border-bottom: none; }
.recent-row:hover { background: var(--bg-raised); }
.recent-left { flex: 1; min-width: 0; }
.recent-meta { display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.3rem; }
.recent-title { font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recent-date { flex-shrink: 0; }

@media (max-width: 640px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .page { padding: 1.25rem 1rem 4rem; }
  .stat { padding: 1rem; }
  .stat-num { font-size: 1.75rem; }
  .recent-row { padding: 0.75rem 1rem; }
}
</style>
