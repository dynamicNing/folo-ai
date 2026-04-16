<template>
  <div class="page">
    <div class="page-header">
      <button class="btn btn-ghost btn-sm" @click="router.back()">← 返回</button>
      <div class="header-info" v-if="item">
        <h1 class="page-title">{{ item.title }}</h1>
        <div class="header-meta">
          <span class="tag">{{ item.category }}</span>
          <span :class="`badge badge-${item.status}`">{{ statusLabel(item.status) }}</span>
          <span class="text-muted text-sm">{{ formatDate(item.date) }}</span>
          <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="!item" class="empty">
      <div class="empty-icon">🔍</div>
      <p>文章不存在</p>
    </div>
    <div v-else class="preview-card card">
      <div class="md-content" v-html="item.content" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const item = ref(null);
const loading = ref(true);

function statusLabel(s) {
  return { published: '已发布', draft: '草稿', archived: '已归档' }[s] || s;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

onMounted(async () => {
  try {
    item.value = await api.getItem(route.params.slug, auth.authHeader());
  } catch {
    item.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.page { padding: 2rem; max-width: 860px; }
.page-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; }
.header-info { flex: 1; }
.page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
.header-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.preview-card { padding: 2rem; }
</style>
