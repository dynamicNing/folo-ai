<template>
  <div class="page">
    <div v-if="loading" class="loading"><div class="spinner" />加载中...</div>
    <div v-else-if="error" class="notice notice-error">{{ error }}</div>

    <template v-else-if="skill">
      <div class="page-head">
        <div>
          <div class="head-meta">
            <span class="tag">{{ categoryLabel(skill.category) }}</span>
            <span class="tag">{{ engineLabel(skill.engine_type) }}</span>
            <span class="tag">{{ providerLabel(skill.default_provider) }}</span>
            <span class="tag">{{ originLabel(skill.source_origin) }}</span>
            <span :class="`badge badge-${skill.status}`">{{ statusLabel(skill.status) }}</span>
          </div>
          <h1 class="page-title">{{ skill.name }}</h1>
          <p class="page-sub">{{ skill.description }}</p>
        </div>
        <NuxtLink to="/admin/skills" class="btn btn-ghost">返回列表</NuxtLink>
      </div>

      <div class="grid">
        <section class="card panel">
          <div class="section-title">基础信息</div>
          <div class="kv-list">
            <div class="kv-row"><span class="kv-label">Slug</span><span class="kv-value mono">{{ skill.slug }}</span></div>
            <div class="kv-row"><span class="kv-label">来源</span><span class="kv-value">{{ originLabel(skill.source_origin) }}</span></div>
            <div class="kv-row"><span class="kv-label">来源标识</span><span class="kv-value">{{ skill.source_label || '—' }}</span></div>
            <div class="kv-row"><span class="kv-label">来源版本</span><span class="kv-value mono">{{ skill.source_version || '—' }}</span></div>
            <div class="kv-row"><span class="kv-label">默认 Provider</span><span class="kv-value">{{ providerLabel(skill.default_provider) }}</span></div>
            <div class="kv-row"><span class="kv-label">默认模型</span><span class="kv-value mono">{{ skill.default_model }}</span></div>
            <div class="kv-row"><span class="kv-label">Source Type</span><span class="kv-value">{{ skill.source_type }}</span></div>
            <div class="kv-row"><span class="kv-label">Source Path</span><span class="kv-value mono">{{ skill.source_path || 'inline' }}</span></div>
            <div class="kv-row"><span class="kv-label">更新时间</span><span class="kv-value">{{ formatDate(skill.updated_at) }}</span></div>
          </div>
        </section>

        <section class="card panel">
          <div class="section-title">权限策略</div>
          <div class="policy-grid">
            <div v-for="item in policyItems" :key="item.key" class="policy-item">
              <div class="policy-label">{{ item.label }}</div>
              <div :class="['policy-value', item.enabled ? 'yes' : 'no']">{{ item.enabled ? '允许' : '关闭' }}</div>
            </div>
          </div>
          <div class="hint">这里展示的是 skill 定义中的默认权限边界。若本次调用命中审批策略，运行后会先停在 `waiting_approval`。</div>
          <div class="hint">内置 `llm_direct` 与 `agent_sdk` skill 已接入当前运行链路；外部 skill 仍只做目录纳管。</div>
        </section>
      </div>

      <div v-if="examples.length || limitations.length || triggerKeywords.length || tags.length" class="guide-grid">
        <section v-if="examples.length" class="card panel">
          <div class="section-title">示例用法</div>
          <div class="example-list">
            <article
              v-for="(example, index) in examples"
              :key="`${example.title}-${index}`"
              :class="['example-card', activeExampleIndex === index ? 'example-card-active' : '']"
            >
              <div class="example-head">
                <div>
                  <div class="example-title">{{ example.title }}</div>
                  <p v-if="example.prompt" class="example-prompt">{{ example.prompt }}</p>
                </div>
                <button v-if="canRun" class="btn btn-ghost" type="button" @click="applyExample(index)">
                  {{ activeExampleIndex === index ? '已载入' : '填入表单' }}
                </button>
              </div>
              <p v-if="example.note" class="example-note">{{ example.note }}</p>
            </article>
          </div>
        </section>

        <section v-if="triggerKeywords.length || limitations.length || tags.length" class="card panel">
          <div class="section-title">触发提示与边界</div>

          <div v-if="tags.length" class="info-block">
            <div class="info-label">标签</div>
            <div class="tag-row">
              <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <div v-if="triggerKeywords.length" class="info-block">
            <div class="info-label">未来 chat 模式可复用的触发词</div>
            <div class="tag-row">
              <span v-for="keyword in triggerKeywords" :key="keyword" class="tag">{{ keyword }}</span>
            </div>
          </div>

          <div v-if="limitations.length" class="info-block">
            <div class="info-label">当前边界</div>
            <ul class="plain-list">
              <li v-for="item in limitations" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>
      </div>

      <div class="schema-grid">
        <section v-if="canRun" class="card panel">
          <div class="section-title">立即调用</div>
          <div class="run-form">
            <div class="run-default">
              <div class="field-label">默认执行配置</div>
              <div class="run-default-main">
                <span class="tag">{{ providerLabel(skill.default_provider) }}</span>
                <span class="run-default-model">{{ defaultRunModelLabel }}</span>
              </div>
              <div class="field-hint">主流程固定走当前 skill 绑定的 Anthropic 路线。常规调用只需要填写参数并点击运行。</div>
              <div v-if="activeExample" class="run-default-tip">当前已载入示例：{{ activeExample.title }}</div>
            </div>

            <div v-if="supportsGuidedForm" class="mode-switch">
              <button
                class="btn"
                :class="{ 'btn-primary': inputMode === 'guided' }"
                type="button"
                @click="switchInputMode('guided')"
              >
                表单模式
              </button>
              <button
                class="btn"
                :class="{ 'btn-primary': inputMode === 'raw' }"
                type="button"
                @click="switchInputMode('raw')"
              >
                高级 JSON
              </button>
            </div>

            <template v-if="inputMode === 'guided' && supportsGuidedForm">
              <div class="guided-grid">
                <label v-for="field in schemaFields" :key="field.key" :class="['field', field.multiline ? 'field-full' : '']">
                  <span class="field-label">
                    {{ field.title }}
                    <span v-if="field.required" class="field-required">*</span>
                  </span>

                  <select v-if="field.kind === 'enum'" v-model="guidedInput[field.key]" class="input">
                    <option v-for="option in field.enumValues" :key="option" :value="option">{{ option }}</option>
                  </select>

                  <textarea
                    v-else-if="field.kind === 'array' || field.multiline"
                    v-model="guidedInput[field.key]"
                    class="textarea"
                    :rows="field.kind === 'array' ? 5 : 6"
                    :placeholder="field.kind === 'array' ? '每行一个值' : ''"
                  />

                  <input
                    v-else-if="field.kind === 'number' || field.kind === 'integer'"
                    v-model.number="guidedInput[field.key]"
                    class="input"
                    type="number"
                    step="1"
                  />

                  <label v-else-if="field.kind === 'boolean'" class="check-row">
                    <input v-model="guidedInput[field.key]" type="checkbox" class="toggle" />
                    <span>启用</span>
                  </label>

                  <input v-else v-model="guidedInput[field.key]" class="input" />
                </label>
              </div>
            </template>

            <template v-else>
              <label class="field">
                <span class="field-label">Input JSON</span>
                <textarea v-model="runForm.inputJson" class="textarea" rows="12" />
                <span class="field-hint">只在参数结构比较特殊时使用高级 JSON 模式。</span>
              </label>

              <label class="field">
                <span class="field-label">临时模型覆盖</span>
                <input v-model.trim="runForm.modelOverride" class="input" placeholder="留空时使用默认模型" />
                <span class="field-hint">只在这次运行临时覆盖模型；留空则直接走默认配置。</span>
              </label>
            </template>

            <div class="action-row">
              <button class="btn btn-primary" :disabled="running" @click="submitRun">
                {{ running ? '运行中...' : '立即运行' }}
              </button>
              <button class="btn btn-ghost" type="button" :disabled="running" @click="resetSampleInput">
                {{ examples.length ? '恢复推荐示例' : '恢复示例参数' }}
              </button>
              <span class="hint">{{ runHint }}</span>
            </div>

            <div v-if="runError" class="notice notice-error">{{ runError }}</div>
          </div>
        </section>

        <section v-else class="card panel">
          <div class="section-title">执行状态</div>
          <div class="hint">
            当前 skill 以目录元数据形式被纳入管理，用于分类、检索与版本追踪；它还没有绑定到本系统内置运行器。
          </div>
          <div class="hint">
            这类 skill 适合先统一纳管；后续如果真要接入运行，应按单个 skill 决定执行路线，而不是默认全部放开。
          </div>
        </section>

        <section class="card panel">
          <div class="section-title">Input Schema</div>
          <pre class="code-block">{{ pretty(skill.input_schema) }}</pre>
        </section>

        <section class="card panel">
          <div class="section-title">Output Schema</div>
          <pre class="code-block">{{ pretty(skill.output_schema) }}</pre>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EngineType, Provider, SkillCategory, SkillDefinitionDetail, SkillExample, SkillOrigin, SkillSourceMetadata, SkillStatus } from '~/types/skill'

definePageMeta({ layout: 'admin', middleware: 'auth' })

type InputMode = 'guided' | 'raw'
type SchemaFieldKind = 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'array'

interface SchemaField {
  key: string
  title: string
  kind: SchemaFieldKind
  enumValues: string[]
  multiline: boolean
  required: boolean
}

const api = useApi()
const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const skill = ref<SkillDefinitionDetail | null>(null)
const running = ref(false)
const runError = ref('')
const activeExampleIndex = ref<number | null>(null)
const inputMode = ref<InputMode>('guided')
const guidedInput = ref<Record<string, any>>({})
const runForm = ref<{
  inputJson: string
  modelOverride: string
}>({
  inputJson: '{}',
  modelOverride: '',
})

const policyItems = computed(() => {
  const policy = skill.value?.tool_policy
  if (!policy) return []
  return [
    { key: 'network', label: '网络访问', enabled: policy.network },
    { key: 'filesystem_read', label: '读取文件', enabled: policy.filesystem_read },
    { key: 'filesystem_write', label: '写入文件', enabled: policy.filesystem_write },
    { key: 'shell', label: 'Shell', enabled: policy.shell },
    { key: 'browser', label: '浏览器', enabled: policy.browser },
    { key: 'approval_required', label: '需要审批', enabled: policy.approval_required },
  ]
})

const canRun = computed(() => !!skill.value && skill.value.status === 'active' && skill.value.source_origin === 'builtin')
const sourceMetadata = computed<SkillSourceMetadata>(() => skill.value?.source_metadata || {})
const schemaFields = computed<SchemaField[]>(() => {
  const schema = skill.value?.input_schema
  const properties = schema?.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return []

  const requiredSet = new Set(Array.isArray(schema.required) ? schema.required.map(item => String(item)) : [])
  return Object.entries(properties as Record<string, unknown>).map(([key, value]) => {
    const field = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    const enumValues = Array.isArray(field.enum) ? field.enum.map(item => String(item)) : []
    const type = String(field.type || 'string')
    const kind: SchemaFieldKind = enumValues.length
      ? 'enum'
      : type === 'number'
        ? 'number'
        : type === 'integer'
          ? 'integer'
          : type === 'boolean'
            ? 'boolean'
            : type === 'array'
              ? 'array'
              : 'string'

    return {
      key,
      title: String(field.title || key),
      kind,
      enumValues,
      multiline: kind === 'string' && /(content|context|notes|note|audience|summary)/i.test(key),
      required: requiredSet.has(key),
    }
  })
})
const supportsGuidedForm = computed(() => schemaFields.value.length > 0)
const tags = computed(() => stringList(sourceMetadata.value.tags))
const triggerKeywords = computed(() => stringList(sourceMetadata.value.trigger_keywords))
const limitations = computed(() => stringList(sourceMetadata.value.limitations))
const examples = computed<SkillExample[]>(() => normalizeExamples(sourceMetadata.value.examples))
const activeExample = computed<SkillExample | null>(() => {
  if (activeExampleIndex.value == null) return null
  return examples.value[activeExampleIndex.value] || null
})
const defaultRunModelLabel = computed(() => {
  if (!skill.value) return ''
  const model = skill.value.default_model.trim()
  if (!model) return '后台默认模型'
  if (model === 'anthropic-default' || model === 'anthropic-config-default') return '后台 Anthropic 默认模型'
  if (model === 'openai-default' || model === 'openai-config-default') return '后台 OpenAI 默认模型'
  return model
})
const runHint = computed(() => {
  if (!skill.value) return ''
  return skill.value.engine_type === 'agent_sdk'
    ? '当前 workflow 会按 Anthropic 默认配置依次完成研究、规划和草稿生成。'
    : '当前会直接按 Anthropic 默认配置执行；如果需要审批，会先停在 waiting_approval。'
})

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function normalizeExamples(value: unknown): SkillExample[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    const input = row.input && typeof row.input === 'object' && !Array.isArray(row.input)
      ? row.input as Record<string, unknown>
      : {}
    return [{
      title: String(row.title || `示例 ${index + 1}`).trim(),
      prompt: typeof row.prompt === 'string' && row.prompt.trim() ? row.prompt.trim() : undefined,
      note: typeof row.note === 'string' && row.note.trim() ? row.note.trim() : undefined,
      input,
    }]
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    skill.value = await api.getSkill(String(route.params.slug || ''))
    activeExampleIndex.value = null
    resetSampleInput()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

function sampleInputFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
    const field = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}

    if (Array.isArray(field.enum) && field.enum.length > 0) {
      result[key] = field.enum[0]
      continue
    }

    switch (field.type) {
      case 'number':
      case 'integer':
        result[key] = 0
        break
      case 'boolean':
        result[key] = false
        break
      case 'array':
        result[key] = []
        break
      default:
        result[key] = ''
    }
  }
  return result
}

function seedGuidedInput(schema: Record<string, unknown>, seed: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {}

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
    const field = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    const current = seed[key]
    if (field.type === 'boolean') {
      result[key] = !!current
      continue
    }
    if (field.type === 'number' || field.type === 'integer') {
      result[key] = typeof current === 'number' ? current : 0
      continue
    }
    if (field.type === 'array') {
      result[key] = Array.isArray(current) ? current.map(item => String(item)).join('\n') : ''
      continue
    }
    result[key] = typeof current === 'string' ? current : ''
  }
  return result
}

function loadPayloadIntoForm(seed: Record<string, unknown>): void {
  if (!skill.value) return
  guidedInput.value = seedGuidedInput(skill.value.input_schema, seed)
  runForm.value = {
    inputJson: JSON.stringify(seed, null, 2),
    modelOverride: '',
  }
  inputMode.value = supportsGuidedForm.value ? 'guided' : 'raw'
}

function resolveRequestedExampleIndex(): number | null {
  if (!examples.value.length) return null
  const raw = Number(route.query.example)
  if (Number.isInteger(raw) && raw >= 0 && raw < examples.value.length) return raw
  return 0
}

function exampleSeed(example: SkillExample): Record<string, unknown> {
  if (example.input && Object.keys(example.input).length > 0) return example.input
  return skill.value ? sampleInputFromSchema(skill.value.input_schema) : {}
}

function applyExample(index: number): void {
  const example = examples.value[index]
  if (!example) return
  activeExampleIndex.value = index
  loadPayloadIntoForm(exampleSeed(example))
}

function buildPayloadFromGuidedInput(): Record<string, unknown> {
  if (!skill.value) return {}

  const payload: Record<string, unknown> = {}
  for (const field of schemaFields.value) {
    const raw = guidedInput.value[field.key]
    switch (field.kind) {
      case 'boolean':
        payload[field.key] = !!raw
        break
      case 'number':
      case 'integer':
        payload[field.key] = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
        break
      case 'array':
        payload[field.key] = String(raw || '')
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean)
        break
      default:
        payload[field.key] = typeof raw === 'string' ? raw : String(raw ?? '')
    }
  }
  return payload
}

function syncRawInputFromGuided(): void {
  runForm.value.inputJson = JSON.stringify(buildPayloadFromGuidedInput(), null, 2)
}

function switchInputMode(mode: InputMode): void {
  if (mode === 'raw') {
    syncRawInputFromGuided()
    inputMode.value = 'raw'
    return
  }

  if (mode === 'guided' && runForm.value.inputJson.trim()) {
    try {
      const parsed = JSON.parse(runForm.value.inputJson) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && skill.value) {
        guidedInput.value = seedGuidedInput(skill.value.input_schema, parsed)
      }
    } catch {
      // keep current guided values if raw JSON is invalid
    }
  }
  inputMode.value = 'guided'
}

function resetSampleInput(): void {
  if (!skill.value) return
  if (activeExampleIndex.value != null && examples.value[activeExampleIndex.value]) {
    applyExample(activeExampleIndex.value)
    return
  }
  const requestedExampleIndex = resolveRequestedExampleIndex()
  if (requestedExampleIndex != null) {
    applyExample(requestedExampleIndex)
    return
  }

  activeExampleIndex.value = null
  const sample = sampleInputFromSchema(skill.value.input_schema)
  loadPayloadIntoForm(sample)
}

async function submitRun() {
  if (!skill.value) return

  running.value = true
  runError.value = ''

  try {
    const parsed = inputMode.value === 'guided'
      ? buildPayloadFromGuidedInput()
      : JSON.parse(runForm.value.inputJson) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Input JSON 必须是对象')
    }

    const run = await api.createSkillRun({
      skill_slug: skill.value.slug,
      input: parsed as Record<string, unknown>,
      model: runForm.value.modelOverride.trim() || undefined,
    })
    await router.push(`/admin/runs/${run.run_uid}`)
  } catch (err) {
    runError.value = (err as Error).message
  } finally {
    running.value = false
  }
}

function pretty(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
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

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

onMounted(load)
watch(() => route.params.slug, () => {
  load()
})
watch(() => route.query.example, () => {
  activeExampleIndex.value = null
  if (skill.value) resetSampleInput()
})
</script>

<style scoped>
.page { padding: 2rem 2rem 4rem; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border); padding-bottom: 1.25rem; }
.head-meta { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.7rem; }
.page-title { font-size: 1.45rem; font-weight: 700; letter-spacing: -0.03em; }
.page-sub { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.92rem; max-width: 720px; line-height: 1.6; }

.grid, .schema-grid, .guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.schema-grid { margin-top: 1rem; }
.guide-grid { margin-top: 1rem; }
.panel { padding: 1.15rem; }
.section-title { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.9rem; }
.run-form { display: flex; flex-direction: column; gap: 0.85rem; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field-full { grid-column: 1 / -1; }
.field-label { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); }
.field-required { color: #dc2626; }
.field-hint { color: var(--text-muted); font-size: 0.8rem; line-height: 1.5; }
.input, .textarea {
  width: 100%;
  border: 1.5px solid var(--border-mid);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text);
  padding: 0.75rem 0.85rem;
  font: inherit;
}
.textarea { resize: vertical; min-height: 220px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
.action-row { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; }
.mode-switch { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.guided-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
.run-default {
  padding: 0.95rem 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-raised);
}
.run-default-main { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-top: 0.45rem; }
.run-default-model { font-family: var(--font-display); font-size: 0.82rem; font-weight: 700; color: var(--accent); letter-spacing: 0.04em; }
.run-default-tip { margin-top: 0.6rem; color: var(--text); font-size: 0.82rem; font-weight: 600; }
.check-row {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 44px;
  color: var(--text);
}
.toggle {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  flex-shrink: 0;
}

.kv-list { display: flex; flex-direction: column; gap: 0.7rem; }
.kv-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding-bottom: 0.7rem; border-bottom: 1px solid var(--border); }
.kv-row:last-child { border-bottom: none; padding-bottom: 0; }
.kv-label { color: var(--text-muted); font-size: 0.84rem; }
.kv-value { text-align: right; font-size: 0.86rem; font-weight: 600; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
.example-list { display: flex; flex-direction: column; gap: 0.8rem; }
.example-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 0.95rem 1rem; background: var(--bg-card); }
.example-card-active { border-color: color-mix(in oklab, var(--accent) 38%, var(--border)); background: var(--bg-raised); }
.example-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.example-title { font-size: 0.9rem; font-weight: 700; }
.example-prompt { margin-top: 0.35rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.6; }
.example-note { margin-top: 0.6rem; color: var(--text); font-size: 0.82rem; line-height: 1.55; }
.info-block + .info-block { margin-top: 1rem; }
.info-label { margin-bottom: 0.5rem; color: var(--text); font-size: 0.84rem; font-weight: 700; }
.tag-row { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
.plain-list { margin: 0; padding-left: 1.1rem; color: var(--text-muted); font-size: 0.86rem; line-height: 1.7; }
.plain-list li + li { margin-top: 0.25rem; }

.policy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
.policy-item { border: 1px solid var(--border); border-radius: var(--radius); padding: 0.85rem 0.9rem; background: var(--bg-card); }
.policy-label { color: var(--text-muted); font-size: 0.78rem; margin-bottom: 0.35rem; }
.policy-value { font-family: var(--font-display); font-size: 0.82rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.policy-value.yes { color: #16a34a; }
.policy-value.no { color: #6b7280; }
.hint { margin-top: 0.9rem; color: var(--text-muted); font-size: 0.82rem; }

.code-block {
  margin: 0;
  padding: 1rem;
  border-radius: var(--radius);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  overflow: auto;
  font-size: 0.76rem;
  line-height: 1.55;
}

.notice { margin-top: 1rem; padding: 0.9rem 1rem; border-radius: var(--radius); border: 1px solid var(--border); }
.notice-error { color: #b91c1c; background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.18); }
.badge-active { background: rgba(34,197,94,0.12); color: #16a34a; }
.badge-disabled { background: rgba(107,114,128,0.14); color: #4b5563; }

@media (max-width: 900px) {
  .grid, .schema-grid, .guide-grid, .policy-grid, .guided-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .page { padding: 1.25rem 1rem 4rem; }
  .page-head { flex-direction: column; }
  .kv-row { flex-direction: column; }
  .kv-value { text-align: left; }
  .example-head { flex-direction: column; }
}
</style>
