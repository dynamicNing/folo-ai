<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="sidebar-top">
        <RouterLink to="/" class="sidebar-logo">
          folo<span class="logo-accent">-</span>ai
        </RouterLink>
        <span class="sidebar-badge">Admin</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/admin" class="nav-item" exact-active-class="active" end>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          概览
        </RouterLink>
        <RouterLink to="/admin/items" class="nav-item" active-class="active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          内容管理
        </RouterLink>
        <RouterLink to="/admin/collector" class="nav-item nav-reserved" active-class="active">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          AI 采集
          <span class="reserved-tag">预留</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" @click="logout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          退出登录
        </button>
      </div>
    </aside>

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
function logout() { auth.logout(); router.push('/admin/login'); }
</script>

<style scoped>
.admin-shell { display: flex; min-height: 100vh; }

.sidebar {
  width: 210px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-right: 1.5px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 0;
}
.sidebar-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.25rem 1.2rem 1.25rem;
  border-bottom: 1px solid var(--border);
}
.sidebar-logo {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text);
  text-decoration: none;
}
.logo-accent { color: var(--accent); }
.sidebar-badge {
  font-size: 0.6rem;
  font-weight: 700;
  font-family: var(--font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--accent-subtle);
  color: var(--accent);
  padding: 0.15em 0.55em;
  border-radius: var(--radius-sm);
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.15s;
  letter-spacing: 0.01em;
}
.nav-item svg { flex-shrink: 0; opacity: 0.7; }
.nav-item:hover { background: var(--bg-raised); color: var(--text); }
.nav-item.active { background: var(--accent-subtle); color: var(--accent); }
.nav-item.active svg { opacity: 1; }
.nav-reserved { opacity: 0.6; }
.reserved-tag {
  margin-left: auto;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--status-gray);
  background: var(--bg-raised);
  padding: 0.1em 0.45em;
  border-radius: 2px;
}

.sidebar-footer {
  padding: 0.75rem;
  border-top: 1px solid var(--border);
}
.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
  font-family: var(--font-display);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  letter-spacing: 0.02em;
}
.logout-btn:hover { background: rgba(220,38,38,0.07); color: #dc2626; }

.admin-main { flex: 1; overflow-y: auto; background: var(--bg); }
</style>
