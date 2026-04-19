import matter from 'gray-matter'
import { marked } from 'marked'
import { db } from './db'

marked.setOptions({ breaks: true, gfm: true })

const GITHUB_OWNER = 'dynamicNing'
const GITHUB_REPO = 'content-archive'
const GITHUB_BRANCH = 'master'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`

interface GithubFile { path: string; sha: string }
interface ChangeSet { added?: string[]; modified?: string[]; removed?: string[] }

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': 'folo-ai',
    Accept: 'application/vnd.github+json',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function fetchRawContent(repoPath: string): Promise<string> {
  const url = `${GITHUB_API}/contents/${repoPath}?ref=${GITHUB_BRANCH}`
  const res = await fetch(url, { headers: { ...githubHeaders(), Accept: 'application/vnd.github.raw' } })
  if (!res.ok) throw new Error(`GitHub raw fetch failed: ${res.status} ${repoPath}`)
  return res.text()
}

async function fetchFileMeta(repoPath: string): Promise<{ sha: string } | null> {
  const res = await fetch(`${GITHUB_API}/contents/${repoPath}`, { headers: githubHeaders() })
  if (!res.ok) return null
  const data = await res.json() as { sha: string }
  return { sha: data.sha }
}

function isIndexableMd(p: string): boolean {
  return p.endsWith('.md')
    && !p.split('/').some(seg => seg.startsWith('_'))
    && !/(^|\/)readme\.md$/i.test(p)
}

async function fetchAllMdFiles(): Promise<GithubFile[]> {
  const res = await fetch(`${GITHUB_API}/git/trees/${GITHUB_BRANCH}?recursive=1`, { headers: githubHeaders() })
  if (!res.ok) throw new Error(`GitHub tree fetch failed: ${res.status}`)
  const data = await res.json() as { tree: Array<{ type: string; path: string; sha: string }> }
  return data.tree
    .filter(f => f.type === 'blob' && isIndexableMd(f.path))
    .map(f => ({ path: f.path, sha: f.sha }))
}

function dateFromSlug(slug: string): string | null {
  const base = slug.split('/').pop() || slug
  const m = base.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function titleFromBody(body: string, slug: string): string {
  const m = body.match(/^#\s+(.+)$/m)
  if (!m) return slug
  return m[1].replace(/^[\s\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/u, '').trim() || slug
}

function summaryFromBody(body: string): string {
  for (const line of body.split('\n')) {
    const clean = line.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim()
    if (clean.length > 30 && !clean.startsWith('📅') && !clean.startsWith('---')) {
      return clean.length > 150 ? clean.slice(0, 150) + '…' : clean
    }
  }
  return ''
}

function categoryFromPath(repoPath: string): string {
  const parts = repoPath.split('/')
  if (parts.length === 1) return 'uncategorized'
  if (parts[0] === 'social') return parts.slice(0, 2).join('/')
  return parts[0]
}

function slugFromPath(repoPath: string): string {
  return repoPath.replace(/\.md$/, '')
}

async function aiSummarize(body: string, missingFields: string[]): Promise<Record<string, unknown>> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) {
    console.warn('[pipeline] MINIMAX_API_KEY not set, skipping AI')
    return {}
  }

  const truncated = body.slice(0, 3000)
  const prompt = `你是一个内容处理助手。分析以下 Markdown 文章内容，为缺失字段生成值。

需要生成的字段：${missingFields.join(', ')}

字段说明：
- title: 文章标题，简洁准确，不超过30字
- tags: 内容标签数组，3-5个，如 ["AI","工具","周报"]
- summary: 文章摘要，100-150字，客观描述核心内容

文章内容：
${truncated}

请严格返回 JSON，只包含需要生成的字段，例如：
{"title":"...","tags":["a","b"],"summary":"..."}`

  try {
    const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })
    if (!res.ok) throw new Error(`MiniMax API error: ${res.status}`)
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    const text = data.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in AI response')
    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('[pipeline] AI error:', (err as Error).message)
    return {}
  }
}

async function processFile({ path: repoPath, sha }: GithubFile): Promise<void> {
  const slug = slugFromPath(repoPath)
  const category = categoryFromPath(repoPath)

  const existing = db.prepare('SELECT sha FROM articles WHERE slug = ?').get(slug) as { sha?: string } | undefined
  if (existing?.sha === sha) {
    console.log(`[pipeline] skip (unchanged): ${repoPath}`)
    return
  }

  console.log(`[pipeline] processing: ${repoPath}`)
  const raw = await fetchRawContent(repoPath)
  const { data: meta, content: body } = matter(raw)

  const missingFields: string[] = []
  if (!meta.title) missingFields.push('title')
  if (!meta.tags || !(meta.tags as unknown[]).length) missingFields.push('tags')
  if (!meta.summary) missingFields.push('summary')

  let aiResult: Record<string, unknown> = {}
  if (missingFields.length > 0) {
    aiResult = await aiSummarize(body, missingFields)
  }

  const title = meta.title || aiResult.title || titleFromBody(body, slug)
  const metaTags = Array.isArray(meta.tags) ? meta.tags : []
  const tags = (metaTags.length ? metaTags : (aiResult.tags as unknown[])) || []
  const summary = meta.summary || aiResult.summary || summaryFromBody(body)
  const slugDate = dateFromSlug(slug)
  const date = meta.date
    ? new Date(meta.date).toISOString()
    : slugDate ? new Date(slugDate).toISOString() : new Date().toISOString()
  const status = meta.status || (slugDate ? 'published' : 'draft')
  const content = marked(body) as string
  const aiFields = missingFields.filter(f => aiResult[f])

  db.prepare(`
    INSERT INTO articles (slug, repo_path, category, title, tags, date, summary, content, status, sha, ai_fields, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      repo_path=excluded.repo_path, category=excluded.category, title=excluded.title,
      tags=excluded.tags, date=excluded.date, summary=excluded.summary,
      content=excluded.content, status=excluded.status, sha=excluded.sha,
      ai_fields=excluded.ai_fields, updated_at=excluded.updated_at
  `).run(
    slug, repoPath, category,
    title, JSON.stringify(Array.isArray(tags) ? tags : []),
    date, summary, content, status, sha,
    JSON.stringify(aiFields), new Date().toISOString()
  )

  console.log(`[pipeline] saved: ${slug} (ai_fields: ${aiFields.join(',') || 'none'})`)
}

async function removeFile(repoPath: string): Promise<void> {
  const slug = slugFromPath(repoPath)
  db.prepare('DELETE FROM articles WHERE slug = ?').run(slug)
  console.log(`[pipeline] removed: ${slug}`)
}

export interface ProcessChangesResult {
  processed: number
  failed: number
  removed: number
  errors: Array<{ path: string; error: string }>
}

export async function processChanges(changes: ChangeSet): Promise<ProcessChangesResult> {
  const { added = [], modified = [], removed = [] } = changes
  const mdFiles = [...added, ...modified].filter(isIndexableMd)
  const removedMd = removed.filter(p => p.endsWith('.md'))
  const errors: Array<{ path: string; error: string }> = []
  let processed = 0
  let removedCount = 0

  for (const repoPath of removedMd) {
    try {
      await removeFile(repoPath)
      removedCount++
    } catch (err) {
      errors.push({ path: repoPath, error: (err as Error).message })
    }
  }

  for (const repoPath of mdFiles) {
    try {
      const meta = await fetchFileMeta(repoPath)
      await processFile({ path: repoPath, sha: meta?.sha || '' })
      processed++
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[pipeline] failed: ${repoPath}`, msg)
      errors.push({ path: repoPath, error: msg })
    }
  }

  return { processed, failed: errors.length, removed: removedCount, errors }
}

export interface SyncAllResult {
  total: number
  processed: number
  failed: number
  errors: Array<{ path: string; error: string }>
}

export async function syncAll(): Promise<SyncAllResult> {
  console.log('[pipeline] starting full sync...')
  const files = await fetchAllMdFiles()
  console.log(`[pipeline] found ${files.length} md files`)
  let done = 0
  const errors: Array<{ path: string; error: string }> = []
  for (const file of files) {
    try {
      await processFile(file)
      done++
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[pipeline] syncAll failed: ${file.path}`, msg)
      errors.push({ path: file.path, error: msg })
    }
  }
  console.log(`[pipeline] full sync done: ${done}/${files.length}`)
  return { total: files.length, processed: done, failed: errors.length, errors }
}
