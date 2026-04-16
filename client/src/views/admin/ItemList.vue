<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">内容管理</h1>
      <div class="header-actions">
        <select v-model="filterStatus" @change="load" class="filter-select">
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="archived">已归档</option>
        </select>
        <select v-model="filterCategory" @change="load" class="filter-select">
          <option value="">全部分类</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>

    <div v-else-if="items.length === 0" class="empty">
      <div class="empty-icon">📭</div>
      <p>暂无内容</p>
    </div>

    <div v-else class="table-wrap card">
      <table class="table">
        <thead>
          <tr>
            <th>标题</th>
            <th>分类</th>
            <th>状态</th>
            <th>日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.slug">
            <td class="td-title">
              <RouterLink :to="`/admin/items/${item.slug}`" class="item-title-link">
                {{ item.title }}
              </RouterLink>
              <span v-if="item.tags.length" class="td-tags">
                <span v-for="t in item.tags.slice(0,2)" :key="t" class="tag" style="font-size:0.7rem">{{ t }}</span>
              </span>
            </td>
            <td><span class="tag">{{ item.category }}</span></td>
            <td>
              <select
                :value="item.status"
                @change="changeStatus(item, $event.target.value)"
                class="status-select"
                :class="`status-${item.status}`"
              >
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="archived">已归档</option>
              </select>
            </td>
            <td class="text-muted text-sm">{{ formatDate(item.date) }}</td>
            <td>
              <div class="td-actions">
                <RouterLink :to="`/article/${item.slug}`" target="_blank" class="btn btn-ghost btn-sm">预览</RouterLink>
                <button class="btn btn-danger btn-sm" @click="confirmDelete(item)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="go(page - 1)">← 上一页</button>
      <span class="text-muted text-sm">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页 →</button>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteTarget" class="modal-mask" @click.self="deleteTarget = null">
      <div class="modal card">
        <h3>确认删除</h3>
        <p class="text-muted" style="margin:0.75rem 0">「{{ deleteTarget.title }}」将移入回收站，确定吗？</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="deleteTarget = null">取消</button>
          <button class="btn btn-danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api';

const auth = useAuthStore();
const items = ref([]);
const categories = ref([]);
const loading = ref(true);
const page = ref(1);
const totalPages = ref(1);
const filterStatus = ref('');
const filterCategory = ref('');
const deleteTarget = ref(null);

async function load() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: 20 };
    if (filterStatus.value) params.status = filterStatus.value;
    if (filterCategory.value) params.category = filterCategory.value;
    const res = await api.getItems(params);
    items.value = res.data;
    totalPages.value = res.totalPages;
  } finally {
    loading.value = false;
  }
}

async function changeStatus(item, status) {
  try {
    await api.updateStatus(item.slug, status, auth.authHeader());
    item.status = status;
  } catch (e) {
    alert(e.message);
  }
}

function confirmDelete(item) { deleteTarget.value = item; }

async function doDelete() {
  try {
    await api.deleteItem(deleteTarget.value.slug, auth.authHeader());
    items.value = items.value.filter(i => i.slug !== deleteTarget.value.slug);
    deleteTarget.value = null;
  } catch (e) {
    alert(e.message);
  }
}

function go(p) { page.value = p; load(); }

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

onMounted(async () => {
  [categories.value] = await Promise.all([
    api.getCategories(),
  ]);
  await load();
});
</script>

<style scoped>
.page { padding: 2rem; }
.page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.page-title { font-size: 1.5rem; font-weight: 700; flex: 1; }
.header-actions { display: flex; gap: 0.75rem; }
.filter-select {
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
}
.table-wrap { overflow-x: auto; }
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.table th {
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}
.table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.table tr:last-child td { border-bottom: none; }
.td-title { min-width: 200px; }
.item-title-link { font-weight: 500; color: var(--text); display: block; }
.item-title-link:hover { color: var(--accent); }
.td-tags { display: flex; gap: 0.3rem; margin-top: 0.25rem; flex-wrap: wrap; }
.status-select {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  font-size: 0.8rem;
  cursor: pointer;
  font-weight: 500;
}
.status-published { border-color: var(--status-published); color: var(--status-published); background: rgba(40,167,69,0.08); }
.status-draft { border-color: var(--status-draft); color: var(--status-draft); background: rgba(108,117,125,0.08); }
.status-archived { border-color: var(--status-archived); color: var(--status-archived); background: rgba(253,126,20,0.08); }
.td-actions { display: flex; gap: 0.5rem; }

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal { padding: 1.5rem; max-width: 360px; width: 90%; }
.modal h3 { font-size: 1.1rem; font-weight: 600; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
</style>
