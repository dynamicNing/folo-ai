import { generateAnthropicText } from './providers/anthropic'
import { generateOpenAIText } from './providers/openai'
import { gatherDailyBriefingResearch } from './workflowSources'
import type { Provider, SkillDefinitionDetail } from '../../types/skill'

interface DirectSkillRunInput {
  skill: SkillDefinitionDetail
  input: Record<string, unknown>
  provider: Provider
  model: string
}

interface AgentSkillRunInput extends DirectSkillRunInput {
  emitEvent?: (eventType: string, payload?: Record<string, unknown>) => Promise<void> | void
}

interface PromptPayload {
  system: string
  prompt: string
  maxTokens?: number
  temperature?: number
}

function asString(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${field} 不能为空`)
  return text
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function generateModelText(provider: Provider, model: string, payload: PromptPayload): Promise<string> {
  return provider === 'anthropic'
    ? generateAnthropicText({
        model,
        system: payload.system,
        prompt: payload.prompt,
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
      })
    : generateOpenAIText({
        model,
        system: payload.system,
        prompt: payload.prompt,
        temperature: payload.temperature,
        maxTokens: payload.maxTokens,
      })
}

function tryParseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as unknown
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>
        }
      } catch {
        // ignore invalid embedded JSON
      }
    }
  }
  return { text }
}

function buildLearningPlanPrompt(input: Record<string, unknown>): PromptPayload {
  const topic = asString(input.topic, 'topic')
  const sourceType = optionalString(input.source_type) || 'concept'
  const depth = optionalString(input.depth) || 'standard'
  const context = optionalString(input.context) || '无'

  return {
    system: '你是一名课程设计师，请输出严格 JSON，不要输出解释文本。',
    prompt: `
请围绕用户主题生成一个学习路径规划，并只返回 JSON。

主题：${topic}
类型：${sourceType}
深度：${depth}
补充上下文：${context}

JSON Schema:
{
  "title": "string",
  "description": "string",
  "learning_goals": ["string"],
  "chapters": [
    {
      "n": 1,
      "title": "string",
      "summary": "string"
    }
  ]
}
`.trim(),
    temperature: 0.3,
    maxTokens: 1600,
  }
}

function buildArticleSummaryPrompt(input: Record<string, unknown>): PromptPayload {
  const content = asString(input.content, 'content')
  const title = optionalString(input.title) || '未命名内容'
  const tone = optionalString(input.tone) || 'neutral'

  return {
    system: '你是一名编辑，请根据输入输出严格 JSON，不要输出任何额外解释。',
    prompt: `
请根据下列内容生成摘要，并只返回 JSON。

标题：${title}
语气：${tone}
正文：
${content}

JSON Schema:
{
  "summary": "string",
  "bullets": ["string", "string", "string"]
}
`.trim(),
    temperature: 0.25,
    maxTokens: 1200,
  }
}

function buildPromptPayload(skill: SkillDefinitionDetail, input: Record<string, unknown>): PromptPayload {
  switch (skill.slug) {
    case 'learning-topic-generator':
      return buildLearningPlanPrompt(input)
    case 'article-summary-polisher':
      return buildArticleSummaryPrompt(input)
    default:
      throw new Error(`当前阶段暂不支持直接运行 skill: ${skill.slug}`)
  }
}

export async function runDirectSkill(input: DirectSkillRunInput): Promise<Record<string, unknown>> {
  const payload = buildPromptPayload(input.skill, input.input)
  const text = await generateModelText(input.provider, input.model, payload)

  const output = tryParseJsonObject(text)
  return {
    ...output,
    _provider: input.provider,
    _model: input.model,
    _raw_text: text,
  }
}

function normalizePlanSections(value: unknown): Array<{ title: string; bullets: string[] }> {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const row = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {}
    const bullets = Array.isArray(row.bullets)
      ? row.bullets.map(b => String(b).trim()).filter(Boolean)
      : []
    return {
      title: String(row.title || '').trim(),
      bullets,
    }
  }).filter(item => item.title)
}

function formatResearchSources(research: Awaited<ReturnType<typeof gatherDailyBriefingResearch>>): string {
  if (!research.combined.length) return '未检索到本地参考材料。'

  return research.combined.map((item, index) => {
    const meta = `category=${item.source}`
    return `${index + 1}. [${item.kind}] ${item.title}\n   - 日期: ${item.date}\n   - ${meta}\n   - 摘要: ${item.snippet}`
  }).join('\n')
}

function buildDailyBriefingPlanPrompt(
  input: Record<string, unknown>,
  research: Awaited<ReturnType<typeof gatherDailyBriefingResearch>>
): PromptPayload {
  const date = asString(input.date, 'date')
  const topic = asString(input.topic, 'topic')
  const locale = optionalString(input.locale) || 'zh-CN'
  const audience = optionalString(input.audience) || '关注 AI 动态的产品和技术读者'
  const sourceNotes = optionalString(input.source_notes) || '未提供额外来源线索'

  return {
    system: '你是一名研究编辑，请先规划日报结构，严格输出 JSON，不要输出解释文字。',
    prompt: `
请为一篇 AI 日报草稿生成结构化写作计划，并只返回 JSON。

日期：${date}
主题：${topic}
语言/区域：${locale}
目标读者：${audience}
补充来源线索：${sourceNotes}
本地检索关键词：${research.keywords.join(', ') || '无'}
本地参考材料：
${formatResearchSources(research)}

JSON Schema:
{
  "headline": "string",
  "angle": "string",
  "sections": [
    {
      "title": "string",
      "bullets": ["string", "string"]
    }
  ],
  "watch_items": ["string"],
  "source_summary": "string"
}
`.trim(),
    temperature: 0.35,
    maxTokens: 1400,
  }
}

function buildDailyBriefingComposePrompt(
  input: Record<string, unknown>,
  plan: Record<string, unknown>,
  research: Awaited<ReturnType<typeof gatherDailyBriefingResearch>>
): PromptPayload {
  const date = asString(input.date, 'date')
  const topic = asString(input.topic, 'topic')
  const locale = optionalString(input.locale) || 'zh-CN'
  const audience = optionalString(input.audience) || '关注 AI 动态的产品和技术读者'
  const sourceNotes = optionalString(input.source_notes) || '未提供额外来源线索'

  return {
    system: '你是一名技术媒体编辑，请根据给定计划写一篇结构清晰的 Markdown 日报草稿。',
    prompt: `
请基于下面的计划写一篇 Markdown 日报草稿。

日期：${date}
主题：${topic}
语言/区域：${locale}
目标读者：${audience}
补充来源线索：${sourceNotes}

写作计划 JSON：
${JSON.stringify(plan, null, 2)}

本地参考材料：
${formatResearchSources(research)}

写作要求：
1. 使用 Markdown。
2. 顶部包含标题和简短导语。
3. 每个 section 用二级标题。
4. 末尾增加“值得继续跟踪”小节。
5. 增加“参考线索”小节，列出本次实际参考的材料标题。
6. 如果来源线索不足，要显式提示这是一版草稿，需人工补充事实校验。
`.trim(),
    temperature: 0.45,
    maxTokens: 2200,
  }
}

export async function runAgentSkill(input: AgentSkillRunInput): Promise<Record<string, unknown>> {
  const emit = async (eventType: string, payload: Record<string, unknown> = {}) => {
    await input.emitEvent?.(eventType, payload)
  }

  switch (input.skill.slug) {
    case 'daily-ai-briefing': {
      await emit('agent.research.started', {})
      const research = await gatherDailyBriefingResearch({
        topic: asString(input.input.topic, 'topic'),
        date: asString(input.input.date, 'date'),
        sourceNotes: optionalString(input.input.source_notes),
        limitPerKind: 6,
      })
      await emit('agent.research.completed', {
        articles: research.articles.length,
        combined: research.combined.length,
      })

      await emit('agent.plan.started', {})
      const planText = await generateModelText(input.provider, input.model, buildDailyBriefingPlanPrompt(input.input, research))
      const plan = tryParseJsonObject(planText)
      const sections = normalizePlanSections(plan.sections)
      const watchItems = Array.isArray(plan.watch_items)
        ? plan.watch_items.map(item => String(item).trim()).filter(Boolean)
        : []
      await emit('agent.plan.completed', {
        sections: sections.length,
        watch_items: watchItems.length,
      })

      await emit('agent.compose.started', {
        sections: sections.length,
      })
      const markdown = await generateModelText(input.provider, input.model, buildDailyBriefingComposePrompt(input.input, plan, research))
      await emit('agent.compose.completed', {
        chars: markdown.length,
      })

      return {
        headline: String(plan.headline || ''),
        angle: String(plan.angle || ''),
        plan,
        markdown,
        items_count: sections.reduce((sum, section) => sum + section.bullets.length, 0),
        watch_items: watchItems,
        sources: research.combined,
        source_counts: {
          articles: research.articles.length,
          combined: research.combined.length,
        },
        _provider: input.provider,
        _model: input.model,
      }
    }
    default:
      throw new Error(`当前阶段暂不支持 agent/workflow skill: ${input.skill.slug}`)
  }
}
