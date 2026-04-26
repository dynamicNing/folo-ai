<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">数据库管理</h1>
        <p class="page-sub">浏览各表数据，支持逐行删除</p>
      </div>
    </div>

    <!-- 表选择 -->
    <div class="tab-bar">
      <button
        v-for="t in TABLES"
        :key="t.name"
        class="tab"
        :class="{ active: activeTable === t.name }"
        @click="switchTable(t.name)"
      >
        {{ t.label }}
        <span v-if="counts[t.name] !== undefined" class="tab-count">{{ counts[t.name] }}</span>
      </button>
    </div>

    <!-- 过滤 + 操作栏 -->
    <div v-if="activeConfig" class="toolbar">
      <input
        v-model="search"
        class="search-input"
        :placeholder="`搜索 ${activeConfig.searchHint}…`"
        @input="onSearch"
      />
      <div class="toolbar-right">
        <span class="total-label">共 {{ total }} 条</span>
        <button
          v-if="selected.size > 0"
          class="btn btn-danger"
          @click="deleteSelected"
        >
          删除选中 ({{ selected.size }})
        </button>
      </div>
    </div>

    <!-- 表格 -->
    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>

    <div v-else-if="rows.length" class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-check">
              <input type="checkbox" :checked="allChecked" :indeterminate="someChecked" @change="toggleAll" />
            </th>
            <th v-for="col in visibleCols" :key="col">{{ col }}</th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="rowKey(row)" :class="{ 'row-selected': selected.has(rowKey(row)) }">
            <td class="col-check">
              <input type="checkbox" :checked="selected.has(rowKey(row))" @change="toggleRow(rowKey(row))" />
            </td>
            <td v-for="col in visibleCols" :key="col" class="data-cell">
              <span :title="String(row[col] ?? '')">{{ formatCell(row[col]) }}</span>
            </td>
            <td class="col-action">
              <button class="del-btn" @click="deleteOne(row)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="empty"><p>暂无数据</p></div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="go(page - 1)">← 上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="go(page + 1)">下一页 →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const auth = useAuthStore()

interface TableConfig {
  name: string
  label: string
  pk: string
  cols: string[]       // 展示哪些列
  searchCol: string    // 搜索哪个字段
  searchHint: string
  orderBy: string
}

const TABLES: TableConfig[] = [
  {
    name: 'articles',
    label: '文章',
    pk: 'slug',
    cols: ['slug', 'category', 'title', 'status', 'date', 'updated_at'],
    searchCol: 'category',
    searchHint: 'category',
    orderBy: 'date DESC',
  },
  {
    name: 'learning_topics',
    label: '学习主题',
    pk: 'topic_slug',
    cols: ['topic_slug', 'title', 'source_type', 'total_chapters', 'created_at'],
    searchCol: 'title',
    searchHint: 'title',
    orderBy: 'created_at DESC',
  },
  {
    name: 'learning_chapters',
    label: '学习章节',
    pk: 'chapter_slug',
    cols: ['topic_slug', 'chapter_slug', 'chapter_no', 'title', 'estimated_minutes'],
    searchCol: 'topic_slug',
    searchHint: 'topic_slug',
    orderBy: 'topic_slug ASC, chapter_no ASC',
  },
  {
    name: 'skill_definitions',
    label: 'Skills',
    pk: 'slug',
    cols: ['slug', 'name', 'category', 'engine_type', 'source_origin', 'status'],
    searchCol: 'name',
    searchHint: 'name',
    orderBy: 'updated_at DESC',
  },
  {
    name: 'skill_runs',
    label: 'Runs',
    pk: 'run_uid',
    cols: ['run_uid', 'skill_slug', 'provider', 'model', 'status', 'created_at'],
    searchCol: 'skill_slug',
    searchHint: 'skill_slug',
    orderBy: 'created_at DESC',
  },
  {
    name: 'sync_logs',
    label: '同步日志',
    pk: 'id',
    cols: ['id', 'source', 'status', 'started_at', 'total', 'processed', 'failed'],
    searchCol: 'status',
    searchHint: 'status',
    orderBy: 'started_at DESC',
  },
  {
    name: 'app_settings',
    label: '设置',
    pk: 'key',
    cols: ['key', 'value', 'updated_at'],
    searchCol: 'key',
    searchHint: 'key',
    orderBy: 'key ASC',
  },
  {
    name: 'artifacts',
    label: 'Artifacts',
    pk: 'id',
    cols: ['id', 'run_uid', 'kind', 'title', 'mime_type', 'created_at'],
    searchCol: 'kind',
    searchHint: 'kind',
    orderBy: 'created_at DESC',
  },
  {
    name: 'admin_logs',
    label: '操作日志',
    pk: 'id',
    cols: ['id', 'action', 'table_name', 'pk_value', 'created_at'],
    searchCol: 'table_name',
    searchHint: 'table_name',
    orderBy: 'created_at DESC',
  },
]

const PAGE_SIZE = 30

const activeTable = ref(TABLES[0].name)
const rows = ref<Record<string, unknown>[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const error = ref('')
const search = ref('')
const selected = reactive(new Set<string>())
const counts = ref<Record<string, number>>({})

const activeConfig = computed(() => TABLES.find(t => t.name === activeTable.value)!)
const visibleCols = computed(() => activeConfig.value.cols)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const allChecked = computed(() => rows.value.length > 0 && rows.value.every(r => selected.has(rowKey(r))))
const someChecked = computed(() => rows.value.some(r => selected.has(rowKey(r))) && !allChecked.value)

function rowKey(row: Record<string, unknown>): string {
  return String(row[activeConfig.value.pk] ?? '')
}

async function fetchRows() {
  loading.value = true
  error.value = ''
  selected.clear()
  try {
    const cfg = activeConfig.value
    const offset = (page.value - 1) * PAGE_SIZE

    // 使用参数化查询
    const searchClause = search.value.trim() ? `WHERE ${cfg.searchCol} LIKE ?` : ''
    const searchParam = search.value.trim() ? `%${search.value.trim()}%` : null
    const params = searchParam ? [searchParam] : []

    const [dataRes, countRes] = await Promise.all([
      $fetch<{ rows: Record<string, unknown>[] }>('/api/db/query', {
        method: 'POST',
        headers: auth.authHeader(),
        body: {
          sql: `SELECT ${cfg.cols.join(', ')} FROM ${cfg.name} ${searchClause} ORDER BY ${cfg.orderBy} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
          params,
        },
      }),
      $fetch<{ rows: Record<string, unknown>[] }>('/api/db/query', {
        method: 'POST',
        headers: auth.authHeader(),
        body: {
          sql: `SELECT COUNT(*) as cnt FROM ${cfg.name} ${searchClause}`,
          params,
        },
      }),
    ])
    rows.value = dataRes.rows || []
    total.value = Number((countRes.rows?.[0] as Record<string, unknown>)?.cnt ?? 0)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function fetchCounts() {
  // 并行查询所有表的行数
  const promises = TABLES.map(t =>
    $fetch<{ rows: Record<string, unknown>[] }>('/api/db/query', {
      method: 'POST',
      headers: auth.authHeader(),
      body: { sql: `SELECT COUNT(*) as cnt FROM ${t.name}`, params: [] },
    }).then(res => ({
      name: t.name,
      count: Number((res.rows?.[0] as Record<string, unknown>)?.cnt ?? 0),
    })).catch(() => ({ name: t.name, count: 0 }))
  )

  const results = await Promise.all(promises)
  for (const { name, count } of results) {
    counts.value[name] = count
  }
}

async function doDelete(pkValues: string[]) {
  if (!pkValues.length) return
  const cfg = activeConfig.value
  await $fetch('/api/db/batch-delete', {
    method: 'POST',
    headers: auth.authHeader(),
    body: { table: cfg.name, pk: cfg.pk, ids: pkValues },
  })
}

async function deleteOne(row: Record<string, unknown>) {
  const key = rowKey(row)
  const preview = String(row[visibleCols.value[1] ?? visibleCols.value[0]] ?? key)
  if (!confirm(`确认删除「${preview}」？`)) return
  try {
    await doDelete([key])
    await Promise.all([fetchRows(), fetchCounts()])
  } catch (e) {
    alert('删除失败：' + (e as Error).message)
  }
}

async function deleteSelected() {
  if (!selected.size) return
  if (selected.size > 50) {
    const confirmed = confirm(
      `即将删除 ${selected.size} 条记录，数量较多，建议先备份数据库。\n\n是否继续执行？`
    )
    if (!confirmed) return
  } else {
    if (!confirm(`确认删除选中的 ${selected.size} 条记录？此操作不可恢复。`)) return
  }
  try {
    await doDelete([...selected])
    await Promise.all([fetchRows(), fetchCounts()])
  } catch (e) {
    alert('删除失败：' + (e as Error).message)
  }
}

function toggleRow(key: string) {
  if (selected.has(key)) selected.delete(key)
  else selected.add(key)
}

function toggleAll() {
  if (allChecked.value) {
    rows.value.forEach(r => selected.delete(rowKey(r)))
  } else {
    rows.value.forEach(r => selected.add(rowKey(r)))
  }
}

function switchTable(name: string) {
  activeTable.value = name
  page.value = 1
  search.value = ''
  fetchRows()
}

function go(p: number) {
  page.value = p
  fetchRows()
}

let searchTimer: ReturnType<typeof setTimeout>
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; fetchRows() }, 350)
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const str = String(value)
  return str.length > 80 ? str.slice(0, 80) + '…' : str
}

onMounted(async () => {
  await Promise.all([fetchRows(), fetchCounts()])
})
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-head { margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem; }

.tab-bar {
  display: flex; gap: 0.25rem; flex-wrap: wrap;
  border-bottom: 1.5px solid var(--border); margin-bottom: 1.25rem;
}
.tab {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.85rem; border: none; background: none;
  font-size: 0.82rem; font-weight: 600; font-family: var(--font-display);
  color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  transition: all 0.15s; white-space: nowrap;
  border-bottom: 2px solid transparent; margin-bottom: -1.5px;
}
.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.tab-count { font-size: 0.68rem; background: var(--bg-raised); border: 1px solid var(--border); border-radius: 99px; padding: 0.05em 0.45em; color: var(--text-muted); }

.toolbar {
  display: flex; align-items: center; gap: 0.75rem;
  margin-bottom: 0.85rem; flex-wrap: wrap;
}
.search-input {
  flex: 1; min-width: 180px; max-width: 320px;
  border: 1.5px solid var(--border-mid); border-radius: var(--radius-sm);
  background: var(--bg-card); color: var(--text);
  padding: 0.5rem 0.85rem; font: inherit; font-size: 0.85rem;
}
.toolbar-right { display: flex; align-items: center; gap: 0.75rem; margin-left: auto; }
.total-label { font-size: 0.8rem; color: var(--text-muted); }

.btn { padding: 0.45rem 0.9rem; border: none; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; font-family: var(--font-display); cursor: pointer; transition: all 0.15s; }
.btn-danger { background: rgba(220,38,38,0.1); color: #dc2626; border: 1px solid rgba(220,38,38,0.25); }
.btn-danger:hover { background: rgba(220,38,38,0.18); }

.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th {
  background: var(--bg-raised); padding: 0.6rem 0.75rem; text-align: left;
  font-weight: 700; border-bottom: 1.5px solid var(--border);
  white-space: nowrap; color: var(--text-muted); font-family: var(--font-display);
  font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase;
}
.data-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr:hover { background: var(--bg-raised); }
.row-selected { background: rgba(var(--accent-rgb, 99,102,241), 0.06) !important; }

.col-check { width: 36px; text-align: center; padding: 0.5rem 0.5rem; }
.col-action { width: 60px; text-align: center; }
.data-cell { max-width: 280px; overflow: hidden; }
.data-cell span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.del-btn {
  padding: 0.25rem 0.55rem; border: 1px solid rgba(220,38,38,0.3);
  border-radius: var(--radius-sm); background: none; color: #dc2626;
  font-size: 0.72rem; font-weight: 600; cursor: pointer; font-family: var(--font-display);
  transition: all 0.15s;
}
.del-btn:hover { background: rgba(220,38,38,0.08); }

.notice-error { padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-top: 0.75rem; font-size: 0.82rem; border: 1px solid rgba(220,38,38,0.3); background: rgba(220,38,38,0.08); color: #dc2626; }
.empty { padding: 3rem; text-align: center; color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius); }

.pagination { display: flex; align-items: center; gap: 0.75rem; justify-content: center; margin-top: 1.25rem; }
.page-btn { padding: 0.4rem 0.9rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
.page-btn:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 0.8rem; color: var(--text-muted); }

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .tab { font-size: 0.75rem; padding: 0.45rem 0.65rem; }
}
</style>
