import fs from 'node:fs'
import path from 'node:path'
import { chapterPath, topicDir, topicIndexPath } from './archivePaths'
import { generateLearningText } from './learningModel'
import { refreshLearningTopic, topicSlugExists } from './learningStore'
import type { LearningDepth, LearningGenerateResponse, LearningSourceType } from '../../types/learning'

interface GenerateLearningInput {
  topic: string
  source_type?: LearningSourceType
  context?: string
  depth?: LearningDepth
}

interface PlannedChapter {
  n: number
  slug: string
  title: string
  estimated_minutes: number
  learning_goals: string[]
  summary: string
}

interface LearningPlan {
  title: string
  slug: string
  description: string
  tags: string[]
  learning_goals: string[]
  chapters: PlannedChapter[]
}

const DEPTH_HINTS: Record<LearningDepth, string> = {
  brief: '控制在 5-6 章，适合快速入门。',
  standard: '控制在 10-14 章，适合系统学习。',
  deep: '控制在 18-22 章，适合深入掌握。',
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function fallbackSlug(): string {
  return `topic-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
}

function uniqueTopicSlug(seed: string): string {
  let slug = sanitizeSlug(seed) || fallbackSlug()
  if (!topicSlugExists(slug)) return slug

  let i = 2
  while (topicSlugExists(`${slug}-${i}`)) i++
  return `${slug}-${i}`
}

function jsonFromText(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('模型未返回 JSON')
  return JSON.parse(match[0]) as Record<string, unknown>
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item).trim()).filter(Boolean)
}

function normalizePlan(raw: Record<string, unknown>, requestedTopic: string, sourceType: LearningSourceType): LearningPlan {
  const rawChapters = Array.isArray(raw.chapters) ? raw.chapters : []

  const chapters = rawChapters.map((item, index): PlannedChapter => {
    const chapter = item as Record<string, unknown>
    const chapterSlug = sanitizeSlug(String(chapter.slug || chapter.title || `chapter-${index + 1}`))
    return {
      n: index + 1,
      slug: `${String(index + 1).padStart(2, '0')}-${chapterSlug || `chapter-${index + 1}`}`,
      title: String(chapter.title || `第${index + 1}章`),
      estimated_minutes: Math.max(10, Number(chapter.estimated_minutes || 20)),
      learning_goals: normalizeStringArray(chapter.learning_goals).slice(0, 4),
      summary: String(chapter.summary || ''),
    }
  }).filter(chapter => chapter.title)

  const totalMinutes = chapters.reduce((sum, chapter) => sum + chapter.estimated_minutes, 0)
  const requestedSlug = sanitizeSlug(String(raw.slug || ''))

  return {
    title: String(raw.title || requestedTopic),
    slug: uniqueTopicSlug(requestedSlug || sanitizeSlug(requestedTopic) || fallbackSlug()),
    description: String(raw.description || `${requestedTopic} 的系统学习路径。`),
    tags: normalizeStringArray(raw.tags).slice(0, 6),
    learning_goals: normalizeStringArray(raw.learning_goals).slice(0, 6),
    chapters: chapters.length > 0 ? chapters : [{
      n: 1,
      slug: '01-overview',
      title: `${requestedTopic} 概览`,
      estimated_minutes: 20,
      learning_goals: [`建立对 ${requestedTopic} 的整体认识`],
      summary: `${requestedTopic} 的入门概览。`,
    }],
  }
}

function buildIndexMarkdown(plan: LearningPlan, sourceType: LearningSourceType): string {
  const now = new Date().toISOString()
  const totalMinutes = plan.chapters.reduce((sum, chapter) => sum + chapter.estimated_minutes, 0)
  const lines: string[] = [
    '---',
    `title: "${plan.title.replace(/"/g, '\\"')}"`,
    'type: learning-topic',
    `topic_slug: ${plan.slug}`,
    `source_type: ${sourceType}`,
    `description: "${plan.description.replace(/"/g, '\\"')}"`,
    `total_chapters: ${plan.chapters.length}`,
    `estimated_read_minutes: ${totalMinutes}`,
    `created_at: ${now}`,
    `updated_at: ${now}`,
    `tags: ${JSON.stringify(plan.tags)}`,
    'learning_goals:',
    ...(plan.learning_goals.length
      ? plan.learning_goals.map(goal => `  - ${goal}`)
      : ['  - 建立完整知识框架', '  - 能够复述核心概念', '  - 能把知识用于实际问题']),
    '---',
    '',
    '## 学习目标',
    '',
    ...(plan.learning_goals.length
      ? plan.learning_goals.map(goal => `- ${goal}`)
      : ['- 建立完整知识框架', '- 能够复述核心概念', '- 能把知识用于实际问题']),
    '',
    '## 学习路径说明',
    '',
    plan.description,
    '',
    '## 目录',
    '',
    ...plan.chapters.map(chapter => `${chapter.n}. [${chapter.title}](./${chapter.slug}.md)`),
    '',
    '## 学习建议',
    '',
    `预计学习时长：${totalMinutes} 分钟`,
    '建议顺序：按章节顺序线性阅读，完成本章思考后再进入下一章。',
  ]

  return `${lines.join('\n')}\n`
}

function buildChapterMarkdown(plan: LearningPlan, chapter: PlannedChapter, body: string): string {
  const now = new Date().toISOString()
  const cleanBody = body.trim()
  const summary = chapter.summary || cleanBody.split('\n').find(line => line.trim()) || ''

  const lines: string[] = [
    '---',
    `title: "${chapter.title.replace(/"/g, '\\"')}"`,
    `topic: "${plan.title.replace(/"/g, '\\"')}"`,
    `topic_slug: ${plan.slug}`,
    `chapter_slug: ${chapter.slug}`,
    `chapter: ${chapter.n}`,
    `total_chapters: ${plan.chapters.length}`,
    `estimated_minutes: ${chapter.estimated_minutes}`,
    `summary: "${summary.replace(/"/g, '\\"')}"`,
    `created_at: ${now}`,
    `updated_at: ${now}`,
    'learning_goals:',
    ...(chapter.learning_goals.length
      ? chapter.learning_goals.map(goal => `  - ${goal}`)
      : ['  - 理解本章核心概念', '  - 能够解释关键机制', '  - 能回答思考题']),
    '---',
    '',
    cleanBody,
    '',
  ]

  return lines.join('\n')
}

async function generatePlan(input: Required<GenerateLearningInput>): Promise<LearningPlan> {
  const prompt = `
你是一名擅长知识拆解的课程设计师。请围绕用户主题输出一个严格 JSON，对学习路径做结构化规划。

主题：${input.topic}
类型：${input.source_type}
深度：${input.depth}。${DEPTH_HINTS[input.depth]}
补充上下文：${input.context || '无'}

输出要求：
1. 只返回 JSON，不要解释。
2. slug 必须是英文 kebab-case。
3. chapters 需要按学习顺序排列。
4. 每章 estimated_minutes 控制在 15-35 分钟。
5. learning_goals 用简短中文短句。

JSON Schema:
{
  "title": "string",
  "slug": "string",
  "description": "string",
  "tags": ["string"],
  "learning_goals": ["string"],
  "chapters": [
    {
      "n": 1,
      "slug": "string",
      "title": "string",
      "estimated_minutes": 20,
      "learning_goals": ["string"],
      "summary": "string"
    }
  ]
}
`.trim()

  const text = await generateLearningText(prompt, {
    task: 'plan',
    maxTokens: 2200,
    temperature: 0.3,
  })
  return normalizePlan(jsonFromText(text), input.topic, input.source_type)
}

async function generateChapterBody(input: Required<GenerateLearningInput>, plan: LearningPlan, chapter: PlannedChapter): Promise<string> {
  const chapterOutline = plan.chapters.map(item => `${item.n}. ${item.title}`).join('\n')
  const prompt = `
你是一位技术学习材料作者。请为指定章节输出 Markdown 正文，不要输出 frontmatter，不要输出额外解释。

主题：${plan.title}
主题说明：${plan.description}
章节：第 ${chapter.n} 章《${chapter.title}》
章节目标：${chapter.learning_goals.join('；') || '理解本章重点'}
全书目录：
${chapterOutline}
用户补充上下文：${input.context || '无'}

正文要求：
1. 使用中文。
2. 必须包含这些二级标题：## 核心概念 / ## 关键术语 / ## 本章小结 / ## 思考题 / ## 延伸阅读
3. “关键术语”使用 Markdown 表格。
4. “思考题”给出 3 个问题。
5. “延伸阅读”给出 2-4 条建议。
6. 内容要适合 15-35 分钟阅读，避免空话。
`.trim()

  return generateLearningText(prompt, {
    task: 'chapter',
    maxTokens: 2600,
    temperature: 0.5,
  })
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => run())
  await Promise.all(workers)
  return results
}

export async function generateLearningTopic(input: GenerateLearningInput): Promise<LearningGenerateResponse> {
  const normalized: Required<GenerateLearningInput> = {
    topic: input.topic.trim(),
    source_type: input.source_type || 'concept',
    context: input.context?.trim() || '',
    depth: input.depth || 'standard',
  }

  if (!normalized.topic) throw new Error('学习主题不能为空')

  const plan = await generatePlan(normalized)
  const dir = topicDir(plan.slug)
  fs.mkdirSync(dir, { recursive: true })

  const bodies = await mapWithConcurrency(plan.chapters, 3, chapter =>
    generateChapterBody(normalized, plan, chapter)
  )

  const filesWritten: string[] = []
  const indexFilePath = topicIndexPath(plan.slug)
  fs.writeFileSync(indexFilePath, buildIndexMarkdown(plan, normalized.source_type), 'utf-8')
  filesWritten.push(indexFilePath)

  for (let i = 0; i < plan.chapters.length; i++) {
    const chapter = plan.chapters[i]
    const filePath = chapterPath(plan.slug, chapter.slug)
    fs.writeFileSync(filePath, buildChapterMarkdown(plan, chapter, bodies[i]), 'utf-8')
    filesWritten.push(filePath)
  }

  const refreshed = refreshLearningTopic(plan.slug)

  return {
    slug: refreshed.topic_slug,
    title: refreshed.title,
    total_chapters: refreshed.total_chapters,
    files_written: filesWritten.map(filePath => path.relative(process.cwd(), filePath).replace(/\\/g, '/')),
    estimated_read_minutes: refreshed.estimated_read_minutes,
  }
}
