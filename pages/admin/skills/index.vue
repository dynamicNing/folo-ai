<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Skills</h1>
        <p class="page-sub">优先展示可直接调用的内置 skill；外部已安装 skill 单独作为目录管理，需要手动同步一次后才会出现在下方。</p>
      </div>
      <div class="head-actions">
        <NuxtLink to="/admin/skill-chat" class="btn btn-ghost">Chat 模式</NuxtLink>
        <button class="btn btn-primary" :disabled="syncing" @click="syncCatalog">
          {{ syncing ? '同步中...' : '同步目录' }}
        </button>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="guide-card card">
      <div class="guide-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
        <h3 class="guide-title">使用说明</h3>
      </div>
      <div class="guide-content">
        <div class="guide-section">
          <h4 class="guide-subtitle">什么是 Skill？</h4>
          <p>Skill 是可复用的 AI 能力单元，每个 skill 封装了特定的任务逻辑（如文章摘要、学习路径生成、日报撰写等），可以通过填写参数直接运行。</p>
        </div>
        <div class="guide-section">
          <h4 class="guide-subtitle">如何使用？</h4>
          <ol class="guide-steps">
            <li><strong>选择 Skill</strong> — 点击下方卡片进入详情页</li>
            <li><strong>填写参数</strong> — 根据 Input Schema 填写必填和可选参数</li>
            <li><strong>立即运行</strong> — 点击「立即运行」按钮，自动跳转到 Run 详情页</li>
            <li><strong>审批（如需要）</strong> — 部分 skill 需要审批（如写文件操作），在 Run 详情页点击「批准」后开始执行</li>
            <li><strong>查看结果</strong> — 运行完成后，在 Output 区域查看结果</li>
          </ol>
        </div>
        <div class="guide-section">
          <h4 class="guide-subtitle">历史记录与导出</h4>
          <p>所有运行记录保存在 <NuxtLink to="/admin/runs" class="guide-link">/admin/runs</NuxtLink>，可查看完整的 Input/Output。支持批量选中导出为 Markdown 格式，自动推送到 GitHub <code>content-archive/skill-runs/</code> 目录。</p>
        </div>
        <div class="guide-section">
          <h4 class="guide-subtitle">内置 Skill 说明</h4>
          <ul class="guide-list">
            <li><strong>文章摘要润色</strong> — 压缩正文为摘要 + 要点，无需审批，秒出结果</li>
            <li><strong>学习主题拆解</strong> — 生成完整章节式学习路径，需审批（写文件），结果在 <NuxtLink to="/learn" class="guide-link">/learn</NuxtLink> 查看</li>
            <li><strong>每日 AI 简报</strong> — 三步流程（研究 → 规划 → 撰写），需审批，输出 Markdown 日报草稿</li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="builtinQuickStarts.length" class="quickstart-card card">
      <div class="quickstart-head">
        <div>
          <h3 class="quickstart-title">快速开始</h3>
          <p class="quickstart-sub">直接进入带示例参数的 skill 详情页，先跑通一遍再调细节。</p>
        </div>
      </div>
      <div class="quickstart-list">
        <NuxtLink
          v-for="item in builtinQuickStarts"
          :key="item.slug"
          :to="item.to"
          class="quickstart-item"
        >
          <div class="quickstart-item-title">{{ item.title }}</div>
          <div class="quickstart-item-prompt">{{ item.prompt }}</div>
        </NuxtLink>
      </div>
    </div>

    <div class="filter-bar card">
      <label class="filter">
        <span class="filter-label">搜索</span>
        <input
          v-model="searchQuery"
          class="filter-input"
          placeholder="名称或描述…"
          @input="onSearch"
        />
      </label>
      <label class="filter">
        <span class="filter-label">分类</span>
        <select v-model="filters.category" class="filter-select" @change="load">
          <option value="">全部</option>
          <option value="prompt">Prompt</option>
          <option value="agent">Agent</option>
          <option value="workflow">Workflow</option>
          <option value="external">External</option>
        </select>
      </label>
      <label class="filter">
        <span class="filter-label">Provider</span>
        <select v-model="filters.provider" class="filter-select" @change="load">
          <option value="">全部</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="external">External</option>
        </select>
      </label>
      <label class="filter">
        <span class="filter-label">状态</span>
        <select v-model="filters.status" class="filter-select" @change="load">
          <option value="">全部</option>
          <option value="active">启用中</option>
          <option value="disabled">已禁用</option>
        </select>
      </label>
      <label class="filter">
        <span class="filter-label">来源</span>
        <select v-model="filters.source_origin" class="filter-select" @change="load">
          <option value="">全部</option>
          <option value="builtin">Built-in</option>
          <option value="external">External</option>
        </select>
      </label>
    </div>

    <div v-if="syncResult" class="notice notice-info">
      已扫描 {{ syncResult.scanned }} 个 skill 目录，新增 {{ syncResult.created }} 个，更新 {{ syncResult.updated }} 个，错误 {{ syncResult.errors.length }} 个。
    </div>

    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>
    <div v-else-if="!skills.length" class="empty card">
      <p>当前筛选下没有可展示的 skill。</p>
      <p class="empty-sub">内置 skill 会直接出现在这里；若要看到本机已安装的外部 skill，请点击右上角『同步目录』。</p>
    </div>
    <div v-else-if="searchQuery && !builtinSkills.length && !externalSkills.length" class="empty card">
      <p>没有匹配 "{{ searchQuery }}" 的 skill。</p>
      <p class="empty-sub">尝试搜索 slug、名称或描述的关键词。</p>
    </div>

    <template v-else>
      <section v-if="builtinSkills.length" class="skill-section">
        <div class="section-head">
          <div>
            <h2 class="section-title">常用内置技能</h2>
            <p class="section-sub">这些 skill 已绑定本系统运行器，进入详情页即可直接调用；如需审批，会在运行后进入审批流。</p>
          </div>
          <span class="section-count">{{ builtinSkills.length }} 个</span>
        </div>

        <div class="skill-list">
          <NuxtLink
            v-for="skill in builtinSkills"
            :key="skill.slug"
            :to="`/admin/skills/${skill.slug}`"
            class="skill-card skill-card-primary card"
          >
            <div class="skill-top">
              <div>
                <div class="skill-name">{{ skill.name }}</div>
                <div class="skill-slug">{{ skill.slug }}</div>
              </div>
              <div class="top-badges">
                <span class="state-pill state-pill-builtin">可运行</span>
                <span :class="`badge badge-${skill.status}`">{{ statusLabel(skill.status) }}</span>
              </div>
            </div>

            <p class="skill-desc">{{ skill.description }}</p>

            <div class="meta-row">
              <span class="tag">{{ categoryLabel(skill.category) }}</span>
              <span class="tag">{{ engineLabel(skill.engine_type) }}</span>
              <span class="tag">{{ providerLabel(skill.default_provider) }}</span>
            </div>

            <div class="bottom-row">
              <span class="model">{{ modelLabel(skill) }}</span>
              <span class="updated">更新于 {{ formatDate(skill.updated_at) }}</span>
            </div>
          </NuxtLink>
        </div>
      </section>

      <section v-if="showExternalSection" class="skill-section">
        <div class="section-head">
          <div>
            <h2 class="section-title">外部技能目录</h2>
            <p class="section-sub">这里收纳你本机已安装的外部 skill，用于统一查看来源、版本和 schema。当前仍不直接运行。</p>
          </div>
          <span class="section-count">{{ externalSkills.length }} 个</span>
        </div>

        <div v-if="!externalSkills.length" class="empty card section-empty">
          <p>当前还没有同步到任何外部 skill。</p>
          <p class="empty-sub">点击右上角『同步目录』后，系统会扫描预设目录并写入目录索引。</p>
        </div>

        <template v-else>
          <div class="skill-list">
            <NuxtLink
              v-for="skill in visibleExternalSkills"
              :key="skill.slug"
              :to="`/admin/skills/${skill.slug}`"
              class="skill-card card"
            >
              <div class="skill-top">
                <div>
                  <div class="skill-name">{{ skill.name }}</div>
                  <div class="skill-slug">{{ skill.slug }}</div>
                </div>
                <div class="top-badges">
                  <span class="state-pill state-pill-external">目录纳管</span>
                  <span :class="`badge badge-${skill.status}`">{{ statusLabel(skill.status) }}</span>
                </div>
              </div>

              <p class="skill-desc">{{ skill.description }}</p>

              <div class="meta-row">
                <span class="tag">{{ categoryLabel(skill.category) }}</span>
                <span class="tag">{{ engineLabel(skill.engine_type) }}</span>
                <span class="tag">{{ originLabel(skill.source_origin) }}</span>
              </div>

              <div class="bottom-row">
                <span class="model">{{ modelLabel(skill) }}</span>
                <span class="updated">更新于 {{ formatDate(skill.updated_at) }}</span>
              </div>
            </NuxtLink>
          </div>

          <div v-if="externalOverflowCount > 0" class="section-actions">
            <button class="btn btn-ghost" type="button" @click="showAllExternal = !showAllExternal">
              {{ showAllExternal ? '收起外部 skill' : `展开剩余 ${externalOverflowCount} 个` }}
            </button>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  EngineType,
  Provider,
  SkillCatalogSyncResponse,
  SkillCategory,
  SkillDefinitionSummary,
  SkillOrigin,
  SkillStatus,
} from '~/types/skill'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const api = useApi()
const loading = ref(false)
const syncing = ref(false)
const error = ref('')
const syncResult = ref<SkillCatalogSyncResponse | null>(null)
const skills = ref<SkillDefinitionSummary[]>([])
const showAllExternal = ref(false)
const searchQuery = ref('')
const filters = ref<{
  category: SkillCategory | ''
  provider: Provider | ''
  status: SkillStatus | ''
  source_origin: SkillOrigin | ''
}>({
  category: '',
  provider: '',
  status: '',
  source_origin: '',
})

function sortSkills(list: SkillDefinitionSummary[]): SkillDefinitionSummary[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

function filterBySearch(list: SkillDefinitionSummary[]): SkillDefinitionSummary[] {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.slug.toLowerCase().includes(q)
  )
}

const builtinSkills = computed(() =>
  filterBySearch(sortSkills(skills.value.filter(skill => skill.source_origin === 'builtin')))
)
const externalSkills = computed(() =>
  filterBySearch(sortSkills(skills.value.filter(skill => skill.source_origin === 'external')))
)
const visibleExternalSkills = computed(() =>
  showAllExternal.value ? externalSkills.value : externalSkills.value.slice(0, 16)
)
const externalOverflowCount = computed(() =>
  Math.max(0, externalSkills.value.length - visibleExternalSkills.value.length)
)
const showExternalSection = computed(() =>
  filters.value.source_origin !== 'builtin'
)
const builtinQuickStarts = computed(() => {
  const presets = [
    {
      slug: 'article-summary-polisher',
      title: '先试摘要润色',
      prompt: '把技术长文压成一段摘要 + 3 个要点',
      example: 0,
    },
    {
      slug: 'learning-topic-generator',
      title: '先试学习主题拆解',
      prompt: '把一本书或一个技能拆成学习路径',
      example: 0,
    },
    {
      slug: 'daily-ai-briefing',
      title: '先试 AI 日报草稿',
      prompt: '观察 research -> plan -> compose 的完整事件流',
      example: 0,
    },
  ]

  return presets.flatMap(item => {
    const skill = skills.value.find(row => row.slug === item.slug && row.source_origin === 'builtin')
    if (!skill) return []
    return [{
      ...item,
      title: skill.name,
      to: `/admin/skills/${skill.slug}?example=${item.example}`,
    }]
  })
})

async function load() {
  loading.value = true
  error.value = ''
  showAllExternal.value = false
  try {
    const res = await api.getSkills(filters.value)
    skills.value = res.data
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function syncCatalog() {
  syncing.value = true
  error.value = ''
  try {
    syncResult.value = await api.syncSkills()
    await load()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    syncing.value = false
  }
}

function onSearch() {
  showAllExternal.value = false
}

function categoryLabel(category: SkillCategory): string {
  return ({ prompt: 'Prompt', agent: 'Agent', workflow: 'Workflow', external: 'External' } as const)[category] || category
}

function engineLabel(engine: EngineType): string {
  return ({ llm_direct: 'Direct', agent_sdk: 'Agent SDK', external: 'External' } as const)[engine] || engine
}

function providerLabel(provider: Provider): string {
  return ({ openai: 'OpenAI', anthropic: 'Anthropic', external: 'External' } as const)[provider] || provider
}

function originLabel(origin: SkillOrigin): string {
  return ({ builtin: 'Built-in', external: 'External' } as const)[origin] || origin
}

function statusLabel(status: SkillStatus): string {
  return ({ active: '启用中', disabled: '已禁用' } as const)[status] || status
}

function modelLabel(skill: SkillDefinitionSummary): string {
  return skill.source_version || skill.default_model
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

onMounted(load)
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-title { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; max-width: 68ch; }

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1.5px solid var(--border);
  padding-bottom: 1.25rem;
}
.head-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.filter-bar { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1rem; padding: 1rem 1.1rem; margin-bottom: 1rem; }
.filter { display: flex; flex-direction: column; gap: 0.4rem; }

.guide-card { padding: 1.5rem 1.75rem; margin-bottom: 1.75rem; background: var(--bg-raised); }
.guide-header { display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; color: var(--accent); }
.guide-title { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.guide-content { display: flex; flex-direction: column; gap: 1.25rem; }
.guide-section { }
.guide-subtitle { font-size: 0.92rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text); }
.guide-section p { color: var(--text-muted); font-size: 0.88rem; line-height: 1.65; margin: 0; }
.guide-steps { margin: 0.5rem 0 0 1.25rem; padding: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.75; }
.guide-steps li { margin-bottom: 0.35rem; }
.guide-steps strong { color: var(--text); font-weight: 600; }
.guide-list { margin: 0.5rem 0 0 1.25rem; padding: 0; color: var(--text-muted); font-size: 0.88rem; line-height: 1.75; }
.guide-list li { margin-bottom: 0.35rem; }
.guide-list strong { color: var(--text); font-weight: 600; }
.guide-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.guide-link:hover { text-decoration: underline; }
.guide-section code { background: var(--bg-card); padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.85em; font-family: ui-monospace, monospace; color: var(--text); border: 1px solid var(--border); }

.quickstart-card { padding: 1.2rem 1.3rem; margin-bottom: 1rem; }
.quickstart-head { margin-bottom: 0.9rem; }
.quickstart-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
.quickstart-sub { margin-top: 0.25rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.55; }
.quickstart-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.8rem; }
.quickstart-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 0.95rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-raised);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.quickstart-item:hover { border-color: var(--accent); transform: translateY(-1px); }
.quickstart-item-title { font-size: 0.88rem; font-weight: 700; }
.quickstart-item-prompt { color: var(--text-muted); font-size: 0.8rem; line-height: 1.55; }

.filter { display: flex; flex-direction: column; gap: 0.4rem; }
.filter-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.filter-input {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.75rem 0.85rem;
  font: inherit;
}
.filter-input::placeholder { color: var(--text-muted); }
.filter-select {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.75rem 0.85rem;
  font: inherit;
}

.notice { margin-top: 1rem; padding: 0.9rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.notice-info { color: var(--text-muted); background: var(--bg-raised); }
.notice-error { color: #b91c1c; background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.18); }

.skill-section + .skill-section { margin-top: 1.35rem; }
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}
.section-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
.section-sub { margin-top: 0.3rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.55; max-width: 72ch; }
.section-count {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.68rem;
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  color: var(--text-muted);
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.section-actions { display: flex; justify-content: center; margin-top: 1rem; }

.skill-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.skill-card {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1.15rem;
  color: inherit;
  text-decoration: none;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.skill-card:hover { transform: translateY(-1px); border-color: var(--accent); }
.skill-card-primary { border-color: color-mix(in oklab, var(--accent) 24%, var(--border)); }
.skill-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.top-badges { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; justify-content: flex-end; }
.skill-name { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
.skill-slug { margin-top: 0.2rem; font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-display); }
.skill-desc { color: var(--text-muted); font-size: 0.88rem; line-height: 1.55; min-height: 4.1em; }
.meta-row, .bottom-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.bottom-row { justify-content: space-between; gap: 1rem; }
.model { font-family: var(--font-display); font-size: 0.76rem; font-weight: 700; color: var(--accent); letter-spacing: 0.04em; }
.updated { color: var(--text-muted); font-size: 0.76rem; }

.state-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.65rem;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.state-pill-builtin { background: rgba(34,197,94,0.12); color: #15803d; }
.state-pill-external { background: rgba(148,163,184,0.18); color: #475569; }

.empty { padding: 1.1rem 1.15rem; }
.empty-sub { margin-top: 0.45rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.55; }
.section-empty { margin-top: 0.25rem; }

.badge-active { background: rgba(34,197,94,0.12); color: #16a34a; }
.badge-disabled { background: rgba(107,114,128,0.14); color: #4b5563; }

@media (max-width: 900px) {
  .skill-list { grid-template-columns: 1fr; }
  .quickstart-list { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head, .section-head { flex-direction: column; }
  .head-actions { width: 100%; }
  .filter-bar { grid-template-columns: 1fr; }
}
</style>
