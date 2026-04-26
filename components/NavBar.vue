<template>
  <nav class="nav">
    <div class="container nav-inner">
      <NuxtLink to="/" class="nav-logo">
        <span class="logo-prompt">~/</span><span class="logo-name">folo-ai</span><span class="logo-cursor">▋</span>
      </NuxtLink>

      <div class="nav-right">
        <NuxtLink to="/learn" class="nav-link">学习</NuxtLink>
        <button class="theme-btn" @click="themeStore.toggle()" :aria-label="themeStore.theme === 'dark' ? '切换亮色' : '切换暗色'">
          <svg v-if="themeStore.theme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <NuxtLink to="/admin" class="nav-admin">[admin]</NuxtLink>
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
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.nav-inner { display: flex; align-items: center; justify-content: space-between; height: 52px; gap: 1.5rem; }

.nav-logo {
  display: flex;
  align-items: baseline;
  gap: 0;
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-muted);
  transition: color 0.12s;
}
.nav-logo:hover { color: var(--text); }
.logo-prompt { color: var(--text-light); }
.logo-name { color: var(--accent); }
.logo-cursor {
  color: var(--accent);
  animation: blink 1.2s step-end infinite;
  font-size: 0.9em;
  margin-left: 1px;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.nav-right { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }

.theme-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border: 1px solid var(--border-mid); background: none;
  color: var(--text-muted); cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.12s;
}
.theme-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(0,255,65,0.05); }

.nav-link {
  display: inline-flex; align-items: center;
  padding: 0.3rem 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  transition: all 0.12s;
}
.nav-link:hover { color: var(--accent); border-color: var(--border-mid); }

.nav-admin {
  display: inline-flex; align-items: center;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-sm);
  font-size: 0.72rem; font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  color: var(--text-muted);
  text-decoration: none;
  transition: all 0.12s;
}
.nav-admin:hover { color: var(--accent); border-color: var(--accent); background: rgba(0,255,65,0.04); }

[data-theme="light"] .theme-btn:hover { border-color: #2355f5; color: #2355f5; background: transparent; }
[data-theme="light"] .nav-admin:hover { color: #2355f5; border-color: #2355f5; background: transparent; }
[data-theme="light"] .logo-name { color: #2355f5; }
[data-theme="light"] .logo-cursor { display: none; }

@media (max-width: 640px) {
  .nav-link { display: none; }
}
</style>

