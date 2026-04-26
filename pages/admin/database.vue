<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">数据库管理</h1>
        <p class="page-sub">直接执行 SQL 查询和操作（谨慎使用）</p>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <span>SQL 查询</span>
      </div>
      <div class="card" style="padding: 1.25rem;">
        <div class="query-form">
          <label class="field">
            <span class="field-label">SQL 语句</span>
            <textarea v-model="sql" class="textarea" rows="8" placeholder="SELECT * FROM articles LIMIT 10;" />
            <span class="field-hint">支持 SELECT、UPDATE、DELETE、INSERT 等操作。修改操作会要求二次确认。</span>
          </label>

          <div class="action-row">
            <button class="btn btn-primary" :disabled="running || !sql.trim()" @click="execute">
              {{ running ? '执行中…' : '执行查询' }}
            </button>
            <button class="btn btn-ghost" type="button" @click="loadPreset('select')">示例：查询</button>
            <button class="btn btn-ghost" type="button" @click="loadPreset('cleanup')">示例：清理 social/*</button>
            <button class="btn btn-ghost" type="button" @click="loadPreset('count')">示例：统计</button>
          </div>
        </div>

        <div v-if="error" class="notice notice-error">{{ error }}</div>
        <div v-if="result" class="result-box">
          <div class="result-head">
            <span class="result-label">执行结果</span>
            <span v-if="result.changes !== undefined" class="result-meta">影响行数: {{ result.changes }}</span>
            <span v-if="result.rows" class="result-meta">返回行数: {{ result.rows.length }}</span>
          </div>

          <div v-if="result.rows && result.rows.length" class="table-wrap">
            <table class="result-table">
              <thead>
                <tr>
                  <th v-for="col in columns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in result.rows" :key="i">
                  <td v-for="col in columns" :key="col">{{ formatCell(row[col]) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else-if="result.changes !== undefined" class="result-message">
            操作成功，影响 {{ result.changes }} 行
          </div>
        </div>
      </div>
    </div>

    <div class="section" style="margin-top: 1.5rem;">
      <div class="section-head">
        <span>表结构</span>
      </div>
      <div class="card" style="padding: 1.25rem;">
        <div class="schema-list">
          <details class="schema-item">
            <summary class="schema-title">articles 表</summary>
            <pre class="schema-code">slug TEXT PRIMARY KEY
repo_path TEXT
category TEXT
title TEXT
tags TEXT (JSON array)
date TEXT (ISO 8601)
summary TEXT
content TEXT
status TEXT (published/draft/archived)
sha TEXT
ai_fields TEXT (JSON)
updated_at TEXT (ISO 8601)</pre>
          </details>

          <details class="schema-item">
            <summary class="schema-title">sync_logs 表</summary>
            <pre class="schema-code">id INTEGER PRIMARY KEY
source TEXT (manual/webhook/cli)
status TEXT (success/failed/partial/running)
started_at TEXT
finished_at TEXT
duration_ms INTEGER
added INTEGER
modified INTEGER
removed INTEGER
total INTEGER
processed INTEGER
failed INTEGER
message TEXT
detail TEXT (JSON)</pre>
          </details>
        </div>
      </div>
    </div>

    <div class="section" style="margin-top: 1.5rem;">
      <div class="section-head">
        <span>快捷操作</span>
      </div>
      <div class="card" style="padding: 1.25rem;">
        <div class="quick-actions">
          <button class="quick-btn" @click="quickAction('count-all')">
            <div class="quick-title">统计所有文章</div>
            <div class="quick-desc">按 category 分组统计</div>
          </button>
          <button class="quick-btn" @click="quickAction('list-categories')">
            <div class="quick-title">查看所有分类</div>
            <div class="quick-desc">DISTINCT category</div>
          </button>
          <button class="quick-btn" @click="quickAction('recent')">
            <div class="quick-title">最近更新</div>
            <div class="quick-desc">最近 20 篇文章</div>
          </button>
          <button class="quick-btn quick-btn-danger" @click="quickAction('cleanup-social')">
            <div class="quick-title">清理 social/*</div>
            <div class="quick-desc">删除 social/* 标签</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const auth = useAuthStore()
const sql = ref('')
const running = ref(false)
const error = ref('')
const result = ref<{ rows?: Record<string, unknown>[]; changes?: number } | null>(null)

const columns = computed(() => {
  if (!result.value?.rows?.length) return []
  return Object.keys(result.value.rows[0])
})

const presets: Record<string, string> = {
  select: 'SELECT slug, category, title, date, status FROM articles ORDER BY date DESC LIMIT 20;',
  cleanup: 'DELETE FROM articles WHERE category LIKE "social/%";',
  count: 'SELECT category, COUNT(*) as count FROM articles GROUP BY category ORDER BY count DESC;',
}

function loadPreset(key: string) {
  sql.value = presets[key] || ''
}

async function execute() {
  if (!sql.value.trim() || running.value) return

  const trimmed = sql.value.trim().toUpperCase()
  const isModify = trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') || trimmed.startsWith('INSERT')

  if (isModify && !confirm('此操作会修改数据库，确认执行？')) return

  running.value = true
  error.value = ''
  result.value = null

  try {
    const res = await $fetch<{ rows?: Record<string, unknown>[]; changes?: number }>('/api/db/query', {
      method: 'POST',
      headers: auth.authHeader(),
      body: { sql: sql.value },
    })
    result.value = res
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    running.value = false
  }
}

async function quickAction(action: string) {
  switch (action) {
    case 'count-all':
      sql.value = 'SELECT category, COUNT(*) as count, status FROM articles GROUP BY category, status ORDER BY category, status;'
      break
    case 'list-categories':
      sql.value = 'SELECT DISTINCT category FROM articles ORDER BY category;'
      break
    case 'recent':
      sql.value = 'SELECT slug, category, title, date, status FROM articles ORDER BY updated_at DESC LIMIT 20;'
      break
    case 'cleanup-social':
      sql.value = 'DELETE FROM articles WHERE category LIKE "social/%";'
      break
  }
  await execute()
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' && value.length > 100) return value.slice(0, 100) + '…'
  return String(value)
}
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.75rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.35rem; }

.section { margin-bottom: 1.5rem; }
.section-head { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; }
.card { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-card); }

.query-form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.field-hint { color: var(--text-muted); font-size: 0.78rem; line-height: 1.5; }
.textarea {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-raised);
  color: var(--text);
  padding: 0.75rem 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  line-height: 1.5;
  resize: vertical;
}

.action-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.btn { padding: 0.5rem 1rem; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; font-family: var(--font-display); cursor: pointer; transition: all 0.15s; border: none; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: none; border: 1px solid var(--border); color: var(--text-muted); }
.btn-ghost:hover { color: var(--text); border-color: var(--text-muted); }

.notice { padding: 0.85rem 1rem; border-radius: var(--radius-sm); margin-top: 1rem; font-size: 0.82rem; border: 1px solid; }
.notice-error { background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.3); color: #dc2626; }

.result-box { margin-top: 1.25rem; border-top: 1.5px solid var(--border); padding-top: 1.25rem; }
.result-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.85rem; flex-wrap: wrap; }
.result-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.result-meta { font-size: 0.78rem; color: var(--text-muted); }
.result-message { padding: 1rem; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3); color: #16a34a; border-radius: var(--radius-sm); font-size: 0.85rem; }

.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
.result-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.result-table th { background: var(--bg-raised); padding: 0.65rem 0.85rem; text-align: left; font-weight: 600; border-bottom: 1.5px solid var(--border); white-space: nowrap; }
.result-table td { padding: 0.65rem 0.85rem; border-bottom: 1px solid var(--border); }
.result-table tr:last-child td { border-bottom: none; }
.result-table tr:hover { background: var(--bg-raised); }

.schema-list { display: flex; flex-direction: column; gap: 0.75rem; }
.schema-item { border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; }
.schema-title { padding: 0.75rem 1rem; background: var(--bg-raised); cursor: pointer; font-weight: 600; font-size: 0.85rem; user-select: none; }
.schema-title:hover { background: var(--bg-card); }
.schema-code { margin: 0; padding: 1rem; background: var(--bg-raised); font-size: 0.76rem; line-height: 1.6; border-top: 1px solid var(--border); }

.quick-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
.quick-btn { padding: 0.85rem 1rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); cursor: pointer; text-align: left; transition: all 0.15s; }
.quick-btn:hover { border-color: var(--accent); background: var(--bg-raised); }
.quick-btn-danger { border-color: rgba(220,38,38,0.3); }
.quick-btn-danger:hover { border-color: #dc2626; background: rgba(220,38,38,0.05); }
.quick-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.25rem; }
.quick-desc { font-size: 0.75rem; color: var(--text-muted); }

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .quick-actions { grid-template-columns: 1fr; }
}
</style>
