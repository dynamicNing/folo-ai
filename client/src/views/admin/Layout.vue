<template>
  <div class="admin-shell">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <RouterLink to="/" class="logo-link">folo-ai</RouterLink>
        <span class="logo-badge">Admin</span>
      </div>
      <nav class="sidebar-nav">
        <RouterLink to="/admin" exact-active-class="active" end class="nav-item">
          <span class="icon">📊</span> 概览
        </RouterLink>
        <RouterLink to="/admin/items" active-class="active" class="nav-item">
          <span class="icon">📝</span> 内容管理
        </RouterLink>
        <RouterLink to="/admin/collector" active-class="active" class="nav-item nav-item-reserved">
          <span class="icon">🤖</span> AI 采集
          <span class="badge badge-draft" style="margin-left:auto;font-size:0.65rem">预留</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <button class="btn btn-ghost btn-sm w-full" @click="logout">退出登录</button>
      </div>
    </aside>

    <!-- 主内容 -->
    <div class="admin-main">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();

function logout() {
  auth.logout();
  router.push('/admin/login');
}
</script>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 1.25rem 0;
}
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 1.25rem 1.25rem;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
}
.logo-link {
  font-weight: 700;
  font-size: 1.1rem;
  background: linear-gradient(90deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.logo-badge {
  font-size: 0.65rem;
  background: var(--accent-subtle);
  color: var(--accent);
  padding: 0.15em 0.5em;
  border-radius: 999px;
  font-weight: 600;
}
.sidebar-nav { flex: 1; padding: 0 0.75rem; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.15s;
  margin-bottom: 0.15rem;
}
.nav-item:hover { background: var(--accent-subtle); color: var(--accent); }
.nav-item.active { background: var(--accent-subtle); color: var(--accent); font-weight: 500; }
.nav-item-reserved { opacity: 0.7; }
.icon { font-size: 1rem; }
.sidebar-footer { padding: 1rem 0.75rem 0; border-top: 1px solid var(--border); }
.w-full { width: 100%; justify-content: center; }
.admin-main { flex: 1; overflow-y: auto; background: var(--bg); }
</style>
