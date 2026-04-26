import { db } from './db'
import type { Article, ArticleStatus, ItemListResponse } from '../../types/article'

interface ArticleRow {
  slug: string
  category: string
  title: string
  tags: string
  date: string
  summary: string
  status: ArticleStatus
  updated_at: string
  content?: string
  repo_path?: string
  sha?: string
  ai_fields?: string
}

interface ListFilters {
  status?: ArticleStatus
  category?: string
  tag?: string
  page?: number
  pageSize?: number
}

export function listArticles(filters: ListFilters = {}): ItemListResponse {
  let sql = 'SELECT slug, category, title, tags, date, summary, status, updated_at FROM articles WHERE 1=1'
  const params: unknown[] = []

  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status) }
  if (filters.category) { sql += ' AND category = ?'; params.push(filters.category) }

  sql += ' ORDER BY date DESC, updated_at DESC'

  let rows = db.prepare(sql).all(...params) as ArticleRow[]
  let items: Article[] = rows.map(r => ({
    slug: r.slug,
    category: r.category,
    title: r.title,
    tags: JSON.parse(r.tags || '[]'),
    date: r.date,
    summary: r.summary,
    status: r.status,
    updated_at: r.updated_at,
    content: '',
  }))

  if (filters.tag) items = items.filter(i => i.tags.includes(filters.tag!))

  const page = Math.max(1, Number(filters.page) || 1)
  const pageSize = Number(filters.pageSize) || 20
  const total = items.length
  const data = items.slice((page - 1) * pageSize, page * pageSize)

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export function getArticle(slug: string): Article | null {
  const row = db.prepare('SELECT * FROM articles WHERE slug = ?').get(slug) as ArticleRow | undefined
  if (!row) return null
  return {
    slug: row.slug,
    category: row.category,
    title: row.title,
    tags: JSON.parse(row.tags || '[]'),
    date: row.date,
    summary: row.summary,
    content: row.content || '',
    status: row.status,
    sha: row.sha,
    updated_at: row.updated_at,
  }
}

const VALID_STATUS: ArticleStatus[] = ['draft', 'published', 'archived']

export function updateArticleStatus(slug: string, status: string): boolean {
  if (!VALID_STATUS.includes(status as ArticleStatus)) {
    throw new Error('Invalid status')
  }
  const result = db.prepare('UPDATE articles SET status = ?, updated_at = ? WHERE slug = ?')
    .run(status, new Date().toISOString(), slug)
  return result.changes > 0
}

export function removeArticle(slug: string): boolean {
  const result = db.prepare('DELETE FROM articles WHERE slug = ?').run(slug)
  return result.changes > 0
}

export function listCategories(): string[] {
  const rows = db.prepare('SELECT DISTINCT category FROM articles').all() as { category: string }[]
  const categories = rows.map(r => r.category).filter(Boolean)
  // 手动添加 Social 标签（数据来自独立的 social API）
  return ['Social', ...categories]
}
