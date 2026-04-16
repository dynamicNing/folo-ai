<template>
  <RouterLink :to="`/article/${item.slug}`" class="feed-item">
    <div class="item-left">
      <div class="item-meta">
        <span class="tag">{{ item.category }}</span>
        <span class="item-date">{{ formatDate(item.date) }}</span>
      </div>
      <h2 class="item-title">{{ item.title }}</h2>
      <p v-if="item.summary" class="item-summary">{{ item.summary }}</p>
    </div>
    <div class="item-arrow">→</div>
  </RouterLink>
</template>

<script setup>
defineProps({ item: Object });

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
</script>

<style scoped>
.feed-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.35rem 0;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: all 0.15s;
  position: relative;
}
.feed-item::before {
  content: '';
  position: absolute;
  left: -1.5rem;
  top: 0; bottom: 0;
  width: 3px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.feed-item:hover::before { opacity: 1; }
.feed-item:last-child { border-bottom: none; }

.item-left { flex: 1; min-width: 0; }

.item-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.45rem;
  flex-wrap: wrap;
}
.item-date {
  font-size: 0.75rem;
  font-family: var(--font-display);
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
.item-title {
  font-size: clamp(1rem, 2.5vw, 1.2rem);
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 0.35rem;
  transition: color 0.15s;
}
.feed-item:hover .item-title { color: var(--accent); }
.item-summary {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-arrow {
  font-size: 1.1rem;
  color: var(--text-light);
  flex-shrink: 0;
  transition: all 0.15s;
}
.feed-item:hover .item-arrow {
  color: var(--accent);
  transform: translateX(3px);
}

@media (max-width: 480px) {
  .feed-item { gap: 0.75rem; padding: 1.1rem 0; }
  /* 左侧装饰线在手机不显示（container 没有 overflow 余地）*/
  .feed-item::before { display: none; }
  .item-summary { display: none; }
}
</style>
