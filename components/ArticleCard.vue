<template>
  <NuxtLink :to="`/article/${item.slug}`" class="feed-item">
    <div class="item-left">
      <div class="item-meta">
        <span class="tag">{{ item.category }}</span>
        <span class="item-date">{{ formatDate(item.date) }}</span>
      </div>
      <h2 class="item-title">{{ item.title }}</h2>
      <p v-if="item.summary" class="item-summary">{{ item.summary }}</p>
    </div>
    <div class="item-arrow">→</div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Article } from '~/types/article'

defineProps<{ item: Article }>()

function formatDate(d: string): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.feed-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.1rem 0;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  color: inherit;
  transition: all 0.12s;
  position: relative;
}
.feed-item::before {
  content: '';
  position: absolute;
  left: -1.5rem;
  top: 0; bottom: 0;
  width: 2px;
  background: var(--accent);
  opacity: 0;
  transition: opacity 0.12s;
  box-shadow: 0 0 6px rgba(0,255,65,0.5);
}
.feed-item:hover::before { opacity: 1; }
.feed-item:last-child { border-bottom: none; }

.item-left { flex: 1; min-width: 0; }
.item-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.35rem;
  flex-wrap: wrap;
}
.item-date {
  font-size: 0.65rem;
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.06em;
}
.item-title {
  font-size: clamp(0.88rem, 2vw, 1rem);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.005em;
  color: var(--text);
  margin-bottom: 0.3rem;
  transition: color 0.12s;
  font-family: var(--font-mono);
}
.feed-item:hover .item-title { color: var(--accent); }
.item-summary {
  font-size: 0.78rem;
  color: var(--text-muted);
  line-height: 1.5;
  font-family: var(--font-mono);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-arrow {
  font-size: 0.9rem;
  color: var(--text-light);
  flex-shrink: 0;
  font-family: var(--font-mono);
  transition: all 0.12s;
}
.feed-item:hover .item-arrow { color: var(--accent); transform: translateX(3px); }

[data-theme="light"] .feed-item::before { box-shadow: none; }
[data-theme="light"] .item-title { font-family: var(--font-display); font-size: clamp(1rem, 2.5vw, 1.2rem); }
[data-theme="light"] .item-summary { font-family: var(--font-body); font-size: 0.875rem; }
[data-theme="light"] .item-date { font-family: var(--font-display); }

@media (max-width: 480px) {
  .feed-item { gap: 0.75rem; padding: 0.9rem 0; }
  .feed-item::before { display: none; }
  .item-summary { display: none; }
}
</style>
