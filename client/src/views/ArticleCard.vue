<template>
  <RouterLink :to="`/article/${item.slug}`" class="card article-card">
    <div class="card-body">
      <div class="card-meta">
        <span class="tag">{{ item.category }}</span>
        <span class="text-muted text-sm">{{ formatDate(item.date) }}</span>
      </div>
      <h2 class="card-title">{{ item.title }}</h2>
      <p v-if="item.summary" class="card-summary">{{ item.summary }}</p>
      <div v-if="item.tags.length" class="card-tags">
        <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
      </div>
    </div>
  </RouterLink>
</template>

<script setup>
const props = defineProps({ item: Object });

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.article-card {
  display: block;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s, box-shadow 0.15s;
}
.article-card:hover { transform: translateY(-2px); color: inherit; }
.card-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.6rem;
}
.card-title {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 0.5rem;
  color: var(--text);
}
.article-card:hover .card-title { color: var(--accent); }
.card-summary {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 0.75rem;
}
.card-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
</style>
