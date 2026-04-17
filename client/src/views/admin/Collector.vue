<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">🐦 社交媒体采集</h1>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="loadStatus" :disabled="loading.status">
          <span v-if="loading.status">⟳</span>
          <span v-else>↻</span>
        </button>
      </div>
    </div>

    <!-- 状态卡片 -->
    <div class="status-cards">
      <div class="status-card" :class="statusClass">
        <div class="status-icon">{{ status.rsshubStatus === 'running' ? '✅' : '❌' }}</div>
        <div class="status-info">
          <div class="status-label">RSSHub</div>
          <div class="status-value">{{ status.rsshubStatus === 'running' ? '运行中' : '已停止' }}</div>
        </div>
      </div>
      <div class="status-card">
        <div class="status-icon">🕐</div>
        <div class="status-info">
          <div class="status-label">最近采集</div>
          <div class="status-value">{{ status.lastRun ? formatTime(status.lastRun) : '从未采集' }}</div>
        </div>
      </div>
    </div>

    <!-- 平台快捷状态 -->
    <div class="platforms-row">
      <div v-for="(info, name) in status.platformLastItems" :key="name" class="platform-chip" :class="name">
        <span class="chip-emoji">{{ platformEmoji[name] }}</span>
        <span class="chip-name">{{ platformNames[name] }}</span>
        <span class="chip-time">{{ info.date ? formatShortTime(info.date) : '无数据' }}</span>
      </div>
      <div v-for="name in missingPlatforms" :key="name" class="platform-chip missing">
        <span class="chip-emoji">{{ platformEmoji[name] }}</span>
        <span class="chip-name">{{ platformNames[name] }}</span>
        <span class="chip-time">无数据</span>
      </div>
    </div>

    <!-- 采集控制 -->
    <div class="section">
      <h2 class="section-title">手动采集</h2>
      <div class="collect-buttons">
        <button
          v-for="p in platforms"
          :key="p.id"
          class="btn collect-btn"
          :class="[p.id, { loading: collecting === p.id }]"
          @click="collectOne(p.id)"
          :disabled="!!collecting || status.rsshubStatus !== 'running'"
        >
          <span v-if="collecting === p.id" class="spin">⟳</span>
          <span v-else>{{ p.emoji }}</span>
          {{ collecting === p.id ? '采集中…' : `采集 ${p.name}` }}
        </button>
        <button
          class="btn collect-btn all"
          :class="{ loading: collecting === 'all' }"
          @click="collectOne('all')"
          :disabled="!!collecting || status.rsshubStatus !== 'running'"
        >
          <span v-if="collecting === 'all'" class="spin">⟳</span>
          <span v-else>🚀</span>
          {{ collecting === 'all' ? '采集中…' : '采集全部' }}
        </button>
      </div>
      <div v-if="collectError" class="error-msg">❌ {{ collectError }}</div>
      <div v-if="collectResult" class="success-msg">
        ✅ 采集完成：
        <span v-for="(r, name) in collectResult" :key="name">
          {{ platformNames[name] }} {{ r.saved }}条{{ r.error ? '⚠️' : '✅' }}
        </span>
      </div>
    </div>

    <!-- 内容列表 -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">采集内容</h2>
        <div class="tab-group">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="switchTab(tab.id)"
          >{{ tab.emoji }} {{ tab.name }}</button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading.items" class="loading-state">
        <span class="spin large">⟳</span> 加载中…
      </div>

      <!-- 空状态 -->
      <div v-else-if="!items.length" class="empty-state">
        <div class="empty-icon">📭</div>
        <div>暂无内容</div>
        <div class="empty-hint">点击上方「采集」按钮开始抓取</div>
      </div>

      <!-- 内容列表 -->
      <div v-else class="items-list">
        <div v-for="item in items" :key="item.url + item.fetched_at" class="item-card" @click="openUrl(item.url)">
          <div class="item-header">
            <span class="item-platform" :class="item._platform">{{ platformEmoji[item._platform] }} {{ platformNames[item._platform] }}</span>
            <span class="item-source">{{ item.source }}</span>
            <span class="item-date">{{ formatShortTime(item.fetched_at) }}</span>
          </div>
          <div class="item-title">{{ item.title }}</div>
          <div v-if="item.description" class="item-desc">{{ truncate(item.description, 100) }}</div>
          <div class="item-footer">
            <span class="item-link">🔗 {{ truncate(item.url, 50) }}</span>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="btn btn-ghost btn-sm" :disabled="page <= 1" @click="loadItems(page - 1)">← 上一页</button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="btn btn-ghost btn-sm" :disabled="page >= totalPages" @click="loadItems(page + 1)">下一页 →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../../api';
import { useAuthStore } from '../../stores/auth';

const platformEmoji = { youtube: '▶️', weibo: '🐦', tech: '📰' };
const platformNames = { youtube: 'YouTube', weibo: '微博', tech: '科技资讯' };
const platforms = [
  { id: 'youtube', name: 'YouTube', emoji: '▶️' },
  { id: 'weibo', name: '微博', emoji: '🐦' },
  { id: 'tech', name: '科技资讯', emoji: '📰' },
];
const tabs = [
  { id: 'all', name: '全部', emoji: '🌐' },
  ...platforms,
];

const status = ref({ rsshubStatus: 'unknown', lastRun: null, platformLastItems: {} });
const loading = ref({ status: false, items: false });
const items = ref([]);
const activeTab = ref('all');
const page = ref(1);
const pageSize = ref(20);
const totalPages = ref(1);
const collecting = ref(null);
const collectError = ref('');
const collectResult = ref(null);

const missingPlatforms = computed(() => {
  return platforms
    .map(p => p.id)
    .filter(id => !status.value.platformLastItems[id]);
});

const statusClass = computed(() => ({
  running: status.value.rsshubStatus === 'running',
  stopped: status.value.rsshubStatus === 'stopped',
  error: status.value.rsshubStatus === 'error' || status.value.rsshubStatus === 'unknown',
}));

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatShortTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

async function loadStatus() {
  loading.value.status = true;
  try {
    status.value = await api.getSocialStatus();
  } catch (e) {
    console.error('status error', e);
  } finally {
    loading.value.status = false;
  }
}

async function loadItems(p = 1) {
  loading.value.items = true;
  page.value = p;
  try {
    const params = { page: p, pageSize: pageSize.value };
    if (activeTab.value !== 'all') params.platform = activeTab.value;
    const res = await api.getSocialItems(params);
    items.value = res.data || [];
    totalPages.value = res.totalPages || 1;
  } catch (e) {
    console.error('items error', e);
  } finally {
    loading.value.items = false;
  }
}

function switchTab(tab) {
  activeTab.value = tab;
  loadItems(1);
}

async function collectOne(platform) {
  collecting.value = platform;
  collectError.value = '';
  collectResult.value = null;
  try {
    const auth = useAuthStore();
    const headers = { Authorization: auth.token };
    const res = await api.triggerCollect(platform, headers);
    collectResult.value = res;
    await loadStatus();
    await loadItems(1);
  } catch (e) {
    collectError.value = e.message;
  } finally {
    collecting.value = null;
    setTimeout(() => { collectResult.value = null; }, 5000);
  }
}

function openUrl(url) {
  if (url) window.open(url, '_blank');
}

onMounted(() => {
  loadStatus();
  loadItems();
});
</script>

<style scoped>
.page { padding: 2rem; max-width: 900px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.page-title { font-size: 1.5rem; font-weight: 700; }
.header-actions { display: flex; gap: 0.5rem; }

.status-cards { display: flex; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.status-card {
  display: flex; align-items: center; gap: 0.75rem;
  background: var(--bg-raised); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.875rem 1.25rem; min-width: 160px;
}
.status-card.running { border-color: #22c55e33; background: #22c55e0d; }
.status-card.stopped { border-color: #ef444433; background: #ef44440d; }
.status-icon { font-size: 1.4rem; }
.status-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.status-value { font-size: 0.9rem; font-weight: 600; margin-top: 0.15rem; }

.platforms-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.platform-chip {
  display: flex; align-items: center; gap: 0.4rem;
  background: var(--bg-raised); border: 1px solid var(--border);
  border-radius: 20px; padding: 0.35rem 0.75rem; font-size: 0.8rem;
}
.platform-chip.missing { opacity: 0.4; }
.chip-emoji { font-size: 0.9rem; }
.chip-name { font-weight: 600; }
.chip-time { color: var(--text-muted); font-size: 0.75rem; }

.section { margin-bottom: 2rem; }
.section-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }

.collect-buttons { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.collect-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1rem; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg-raised);
  font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.collect-btn:hover:not(:disabled) { background: var(--bg); }
.collect-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.collect-btn.youtube:hover:not(:disabled) { border-color: #ff4444; color: #ff4444; }
.collect-btn.weibo:hover:not(:disabled) { border-color: #ffa500; color: #ffa500; }
.collect-btn.tech:hover:not(:disabled) { border-color: #3b82f6; color: #3b82f6; }
.collect-btn.all { background: var(--accent); color: white; border-color: var(--accent); }
.collect-btn.all:hover:not(:disabled) { filter: brightness(1.1); }

.error-msg { margin-top: 0.6rem; font-size: 0.82rem; color: #ef4444; }
.success-msg { margin-top: 0.6rem; font-size: 0.82rem; color: #22c55e; }

.tab-group { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.tab-btn {
  padding: 0.35rem 0.75rem; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent;
  font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.tab-btn:hover { background: var(--bg-raised); }
.tab-btn.active { background: var(--accent-subtle); border-color: var(--accent); color: var(--accent); }

.loading-state, .empty-state {
  text-align: center; padding: 3rem 1rem;
  color: var(--text-muted); font-size: 0.9rem;
}
.empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.empty-hint { font-size: 0.8rem; margin-top: 0.5rem; }

.items-list { display: flex; flex-direction: column; gap: 0.6rem; }
.item-card {
  background: var(--bg-raised); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 0.875rem 1rem; cursor: pointer;
  transition: all 0.15s;
}
.item-card:hover { border-color: var(--accent); background: var(--bg); }
.item-header {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  margin-bottom: 0.4rem; font-size: 0.72rem;
}
.item-platform { font-weight: 700; }
.item-platform.youtube { color: #ff4444; }
.item-platform.weibo { color: #ffa500; }
.item-platform.tech { color: #3b82f6; }
.item-source { color: var(--text-muted); }
.item-date { color: var(--text-muted); margin-left: auto; }
.item-title { font-weight: 600; font-size: 0.9rem; line-height: 1.4; margin-bottom: 0.25rem; }
.item-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; }
.item-footer { margin-top: 0.35rem; }
.item-link { font-size: 0.75rem; color: var(--text-muted); word-break: break-all; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.25rem; }
.page-info { font-size: 0.85rem; color: var(--text-muted); }

.spin { display: inline-block; animation: spin 0.8s linear infinite; }
.spin.large { font-size: 1.5rem; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
