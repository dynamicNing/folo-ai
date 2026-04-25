import { db } from './db'
import { getItems } from './collector'
import type { SocialItem } from '../../types/article'

interface ArticleResearchRow {
  slug: string
  category: string
  title: string
  tags: string
  date: string | null
  summary: string
  updated_at: string
}

export interface ResearchSource {
  kind: 'article' | 'social'
  title: string
  snippet: string
  date: string
  source: string
  score: number
  url?: string
  meta?: Record<string, unknown>
}

export interface ResearchBundle {
  query: string
  keywords: string[]
  articles: ResearchSource[]
  socials: ResearchSource[]
  combined: ResearchSource[]
}

function tokenize(input: string): string[] {
  const raw = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean)

  const deduped = Array.from(new Set(raw))
  return deduped.filter(token => token.length >= 2)
}

function countMatches(text: string, keywords: string[]): number {
  const hay = text.toLowerCase()
  let score = 0
  for (const keyword of keywords) {
    if (!keyword) continue
    if (hay.includes(keyword)) score += keyword.length >= 4 ? 3 : 2
  }
  return score
}

function recencyBonus(dateText: string, targetDate: string): number {
  const source = new Date(dateText).getTime()
  const target = new Date(targetDate).getTime()
  if (!Number.isFinite(source) || !Number.isFinite(target)) return 0
  const deltaDays = Math.abs(source - target) / (24 * 60 * 60 * 1000)
  if (deltaDays <= 1) return 4
  if (deltaDays <= 3) return 2
  if (deltaDays <= 7) return 1
  return 0
}

function normalizeSnippet(value: string, max = 220): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

function articleToSource(row: ArticleResearchRow, keywords: string[], targetDate: string): ResearchSource | null {
  const tags = (() => {
    try {
      const parsed = JSON.parse(row.tags || '[]') as unknown
      return Array.isArray(parsed) ? parsed.map(tag => String(tag)) : []
    } catch {
      return []
    }
  })()

  const text = [row.title, row.summary, row.category, ...tags].join(' ')
  const score = countMatches(text, keywords) + recencyBonus(row.date || row.updated_at, targetDate)
  if (score <= 0) return null

  return {
    kind: 'article',
    title: row.title,
    snippet: normalizeSnippet(row.summary || row.title),
    date: row.date || row.updated_at,
    source: row.category,
    score,
    meta: {
      slug: row.slug,
      tags,
    },
  }
}

function socialToSource(item: SocialItem, keywords: string[], targetDate: string): ResearchSource | null {
  const text = [item.title, item.description || '', item.source || '', item.platform || '', item._platform || ''].join(' ')
  const score = countMatches(text, keywords) + recencyBonus(item.fetched_at, targetDate)
  if (score <= 0) return null

  return {
    kind: 'social',
    title: item.title,
    snippet: normalizeSnippet(item.description || item.title),
    date: item.fetched_at,
    source: item.source || item.platform || item._platform || 'social',
    score,
    url: item.url,
    meta: {
      platform: item.platform || item._platform || '',
    },
  }
}

function dedupeSources(items: ResearchSource[]): ResearchSource[] {
  const map = new Map<string, ResearchSource>()
  for (const item of items) {
    const key = `${item.kind}:${item.title.toLowerCase()}`
    const existing = map.get(key)
    if (!existing || existing.score < item.score) {
      map.set(key, item)
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
}

export async function gatherDailyBriefingResearch(input: {
  topic: string
  date: string
  sourceNotes?: string
  limitPerKind?: number
}): Promise<ResearchBundle> {
  const query = `${input.topic} ${input.sourceNotes || ''}`.trim()
  const keywords = tokenize(query)
  const limit = Math.min(Math.max(input.limitPerKind || 6, 1), 12)

  const articleRows = db.prepare(`
    SELECT slug, category, title, tags, date, summary, updated_at
    FROM articles
    WHERE status = 'published'
    ORDER BY COALESCE(date, updated_at) DESC
    LIMIT 120
  `).all() as ArticleResearchRow[]

  const articleSources = dedupeSources(
    articleRows
      .map(row => articleToSource(row, keywords, input.date))
      .filter(Boolean) as ResearchSource[]
  ).slice(0, limit)

  const socialRes = await getItems({ platform: 'all', page: 1, pageSize: 120 }).catch(() => ({
    data: [] as SocialItem[],
    total: 0,
    page: 1,
    pageSize: 120,
    totalPages: 0,
  }))

  const socialSources = dedupeSources(
    socialRes.data
      .map(item => socialToSource(item, keywords, input.date))
      .filter(Boolean) as ResearchSource[]
  ).slice(0, limit)

  const combined = dedupeSources([...articleSources, ...socialSources]).slice(0, limit * 2)

  return {
    query,
    keywords,
    articles: articleSources,
    socials: socialSources,
    combined,
  }
}
