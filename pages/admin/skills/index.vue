<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Skills</h1>
        <p class="page-sub">优先展示可直接调用的内置 skill；外部已安装 skill 单独作为目录管理，需要手动同步一次后才会出现在下方。</p>
      </div>
      <button class="btn btn-primary" :disabled="syncing" @click="syncCatalog">
        {{ syncing ? '同步中...' : '同步目录' }}
      </button>
    </div>

    <div class="filter-bar card">
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
      <p class="empty-sub">内置 skill 会直接出现在这里；若要看到本机已安装的外部 skill，请点击右上角“同步目录”。</p>
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
          <p class="empty-sub">点击右上角“同步目录”后，系统会扫描预设目录并写入目录索引。</p>
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

const builtinSkills = computed(() =>
  sortSkills(skills.value.filter(skill => skill.source_origin === 'builtin'))
)
const externalSkills = computed(() =>
  sortSkills(skills.value.filter(skill => skill.source_origin === 'external'))
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
.filter-bar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; padding: 1rem 1.1rem; margin-bottom: 1rem; }
.filter { display: flex; flex-direction: column; gap: 0.4rem; }
.filter-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
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
}

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head, .section-head { flex-direction: column; }
  .filter-bar { grid-template-columns: 1fr; }
}
</style>
