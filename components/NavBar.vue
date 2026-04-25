<template>
  <nav class="nav">
    <div class="container nav-inner">
      <NuxtLink to="/" class="nav-logo">
        <span class="logo-name">folo<span class="logo-accent">-</span>ai</span>
        <span class="logo-tag">Follow One Step</span>
      </NuxtLink>

      <div class="nav-right">
        <NuxtLink to="/learn" class="nav-link">学习</NuxtLink>
        <button class="theme-btn" @click="themeStore.toggle()" :aria-label="themeStore.theme === 'light' ? '切换暗色' : '切换亮色'">
          <svg v-if="themeStore.theme === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <NuxtLink to="/admin" class="nav-admin">管理<span class="admin-arrow">↗</span></NuxtLink>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useThemeStore } from '~/stores/theme'

const themeStore = useThemeStore()
</script>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg-nav);
  border-bottom: 1.5px solid var(--border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.nav-inner { display: flex; align-items: center; justify-content: space-between; height: 60px; gap: 1.5rem; }
.nav-logo { display: flex; align-items: baseline; gap: 0.55rem; text-decoration: none; flex-shrink: 0; transition: opacity 0.15s; }
.nav-logo:hover { opacity: 0.75; }
.logo-name { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: var(--text); letter-spacing: -0.03em; }
.logo-accent { color: var(--accent); }
.logo-tag { font-family: var(--font-display); font-size: 0.65rem; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-muted); }

.nav-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.theme-btn {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border: none; background: none;
  color: var(--text-muted); cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}
.theme-btn:hover { background: var(--bg-raised); color: var(--text); }
.nav-admin {
  display: inline-flex; align-items: center; gap: 0.15em;
  padding: 0.4rem 0.9rem;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius-sm);
  font-size: 0.8rem; font-weight: 700; font-family: var(--font-display);
  letter-spacing: 0.03em; color: var(--text-muted);
  text-decoration: none; text-transform: uppercase;
  transition: all 0.15s; white-space: nowrap;
}
.nav-link {
  display: inline-flex; align-items: center;
  min-height: 40px;
  padding: 0 0.4rem;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.nav-link:hover { color: var(--accent); }
.nav-admin:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-subtle); }
.admin-arrow { font-size: 0.9em; transition: transform 0.15s; }
.nav-admin:hover .admin-arrow { transform: translate(1px, -1px); }

@media (max-width: 640px) {
  .logo-tag { display: none; }
  .nav-link { display: none; }
}
</style>
