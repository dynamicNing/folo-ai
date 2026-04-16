<template>
  <nav class="nav">
    <div class="container nav-inner">
      <RouterLink to="/" class="nav-logo">
        <span class="logo-text">folo-ai</span>
        <span class="logo-sub">只慢别人一步</span>
      </RouterLink>

      <div class="nav-center">
        <RouterLink
          v-for="cat in categories"
          :key="cat"
          :to="`/category/${cat}`"
          class="nav-cat"
          :class="{ active: currentCategory === cat }"
        >{{ cat }}</RouterLink>
      </div>

      <div class="nav-right">
        <button class="theme-btn" @click="themeStore.toggle()" :title="themeStore.theme === 'light' ? '切换暗色' : '切换亮色'">
          {{ themeStore.theme === 'light' ? '🌙' : '☀️' }}
        </button>
        <RouterLink to="/admin" class="btn btn-ghost btn-sm">管理</RouterLink>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useThemeStore } from '../stores/theme';
import { api } from '../api';

const themeStore = useThemeStore();
const route = useRoute();
const categories = ref([]);
const currentCategory = computed(() => route.params.name);

onMounted(async () => {
  try {
    categories.value = await api.getCategories();
  } catch {}
});
</script>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-nav);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
}
.nav-inner {
  display: flex;
  align-items: center;
  height: 56px;
  gap: 1.5rem;
}
.nav-logo {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  text-decoration: none;
  flex-shrink: 0;
}
.logo-text {
  font-size: 1.1rem;
  font-weight: 700;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.logo-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.nav-center {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}
.nav-cat {
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.875rem;
  color: var(--text-muted);
  transition: all 0.15s;
  text-decoration: none;
}
.nav-cat:hover, .nav-cat.active {
  background: var(--accent-subtle);
  color: var(--accent);
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.theme-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem;
  border-radius: var(--radius);
  transition: background 0.15s;
}
.theme-btn:hover { background: var(--accent-subtle); }
</style>
