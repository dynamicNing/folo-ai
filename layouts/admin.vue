<template>
  <div class="admin-shell">
    <header class="mobile-topbar">
      <NuxtLink to="/" class="mobile-logo">folo<span class="logo-accent">-</span>ai</NuxtLink>
      <button class="mobile-menu-btn" @click="drawerOpen = !drawerOpen" :aria-label="drawerOpen ? '关闭菜单' : '打开菜单'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line v-if="!drawerOpen" x1="3" y1="6" x2="21" y2="6"/><line v-if="!drawerOpen" x1="3" y1="12" x2="21" y2="12"/><line v-if="!drawerOpen" x1="3" y1="18" x2="21" y2="18"/>
          <line v-if="drawerOpen" x1="18" y1="6" x2="6" y2="18"/><line v-if="drawerOpen" x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </header>

    <div v-if="drawerOpen" class="drawer-mask" @click="drawerOpen = false" />

    <aside class="sidebar" :class="{ open: drawerOpen }">
      <div class="sidebar-top">
        <NuxtLink to="/" class="sidebar-logo" @click="drawerOpen = false">
          folo<span class="logo-accent">-</span>ai
        </NuxtLink>
        <span class="sidebar-badge">Admin</span>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink to="/admin" class="nav-item" exact-active-class="active" @click="drawerOpen = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          概览
        </NuxtLink>
        <NuxtLink to="/admin/items" class="nav-item" active-class="active" @click="drawerOpen = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          内容管理
        </NuxtLink>
        <NuxtLink to="/admin/learn" class="nav-item" active-class="active" @click="drawerOpen = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          学习拆解
        </NuxtLink>
        <NuxtLink to="/admin/collector" class="nav-item" active-class="active" @click="drawerOpen = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          社交采集
        </NuxtLink>
        <NuxtLink to="/admin/sync" class="nav-item" active-class="active" @click="drawerOpen = false">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          内容同步
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" @click="logout">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          退出登录
        </button>
      </div>
    </aside>

    <div class="admin-main">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const drawerOpen = ref(false)
async function logout() {
  await auth.logout()
  router.push('/admin/login')
}
</script>

<style scoped>
.admin-shell { display: flex; min-height: 100vh; }
.mobile-topbar {
  display: none; position: fixed; top: 0; left: 0; right: 0;
  height: 52px; background: var(--bg-card);
  border-bottom: 1.5px solid var(--border); padding: 0 1rem;
  align-items: center; justify-content: space-between; z-index: 300;
}
.mobile-logo { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; letter-spacing: -0.03em; color: var(--text); text-decoration: none; }
.mobile-menu-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: none; background: none; color: var(--text); cursor: pointer; border-radius: var(--radius-sm); }
.drawer-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 290; backdrop-filter: blur(1px); }

.sidebar { width: 210px; flex-shrink: 0; background: var(--bg-card); border-right: 1.5px solid var(--border); display: flex; flex-direction: column; padding: 0; }
.sidebar-top { display: flex; align-items: center; gap: 0.6rem; padding: 1.25rem 1.2rem; border-bottom: 1px solid var(--border); }
.sidebar-logo { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; letter-spacing: -0.03em; color: var(--text); text-decoration: none; }
.logo-accent { color: var(--accent); }
.sidebar-badge { font-size: 0.6rem; font-weight: 700; font-family: var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; background: var(--accent-subtle); color: var(--accent); padding: 0.15em 0.55em; border-radius: var(--radius-sm); }

.sidebar-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem; }
.nav-item { display: flex; align-items: center; gap: 0.65rem; padding: 0.55rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; font-family: var(--font-display); color: var(--text-muted); text-decoration: none; transition: all 0.15s; letter-spacing: 0.01em; }
.nav-item svg { flex-shrink: 0; opacity: 0.7; }
.nav-item:hover { background: var(--bg-raised); color: var(--text); }
.nav-item.active { background: var(--accent-subtle); color: var(--accent); }
.nav-item.active svg { opacity: 1; }

.sidebar-footer { padding: 0.75rem; border-top: 1px solid var(--border); }
.logout-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem; border: none; background: transparent; color: var(--text-muted); font-size: 0.8rem; font-weight: 600; font-family: var(--font-display); cursor: pointer; border-radius: var(--radius-sm); transition: all 0.15s; letter-spacing: 0.02em; }
.logout-btn:hover { background: rgba(220,38,38,0.07); color: #dc2626; }

.admin-main { flex: 1; overflow-y: auto; background: var(--bg); }

@media (max-width: 768px) {
  .mobile-topbar { display: flex; }
  .drawer-mask { display: block; }
  .admin-shell { flex-direction: column; padding-top: 52px; }
  .sidebar { position: fixed; top: 52px; left: 0; bottom: 0; width: 240px; z-index: 295; transform: translateX(-100%); transition: transform 0.25s ease; box-shadow: var(--shadow-md); }
  .sidebar.open { transform: translateX(0); }
  .admin-main { padding-top: 0; }
}
</style>
