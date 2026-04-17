import { execSync } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'
import type { CustomFeed, SocialItem, SocialItemListResponse, SocialStatus } from '../../types/article'

function contentArchiveDir(): string {
  return process.env.CONTENT_ARCHIVE_DIR || '/root/content-archive'
}

function socialDir(): string { return path.join(contentArchiveDir(), 'social') }
function stateFile(): string { return path.join(socialDir(), '.collector-state.json') }
function customFeedsFile(): string { return path.resolve(process.cwd(), 'data/custom-feeds.json') }
function collectorScript(): string {
  return process.env.COLLECTOR_SCRIPT || '/root/.openclaw/workspace/skills/social-media-collector/scripts/collector.py'
}

const PLATFORM_META: Record<string, { emoji: string; name: string }> = {
  youtube: { emoji: '▶️', name: 'YouTube' },
  weibo: { emoji: '🐦', name: '微博热搜' },
  tech: { emoji: '📰', name: '科技资讯' },
  custom: { emoji: '📡', name: '自定义RSS' },
}

interface RawItem {
  title: string
  url?: string
  source?: string
  description?: string
  fetched_at?: string
  platform?: string
}

function writeItemsMd(dateStr: string, platform: string, items: RawItem[]): string {
  fs.mkdirSync(socialDir(), { recursive: true })
  const outPath = path.join(socialDir(), `${dateStr}-${platform}.md`)

  const lines: string[] = [`# 🐦 社交媒体采集 · ${dateStr}`, '']
  const grouped: Record<string, RawItem[]> = {}
  for (const item of items) {
    const src = item.source || platform
    if (!grouped[src]) grouped[src] = []
    grouped[src].push(item)
  }

  for (const [src, srcItems] of Object.entries(grouped)) {
    const meta = PLATFORM_META[platform] || { emoji: '📌', name: platform }
    lines.push(`## ${meta.emoji} ${src}`)
    for (const item of srcItems) {
      const title = item.title || '(无标题)'
      const url = item.url || ''
      const desc = item.description ? ` — ${item.description.slice(0, 60)}` : ''
      if (url) lines.push(`- [${title}](${url})${desc}`)
      else lines.push(`- ${title}${desc}`)
    }
    lines.push('')
  }

  lines.push(`> 采集时间: ${new Date().toLocaleString('zh-CN')} | 共 ${items.length} 条`)
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8')
  return outPath
}

function parseItemsMd(filePath: string): SocialItem[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const dateMatch = path.basename(filePath).match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/)
    const dateStr = dateMatch ? dateMatch[1] : ''
    const platform = dateMatch ? dateMatch[2] : ''
    const lines = content.split('\n')
    const items: SocialItem[] = []
    let currentSource = platform

    for (const line of lines) {
      const sectionMatch = line.match(/^## \S+ (.+)/)
      if (sectionMatch) { currentSource = sectionMatch[1]; continue }
      const itemMatch = line.match(/^\- \[(.+?)\]\((https?:\/\/[^\)]+)\)\)/)
      if (itemMatch) {
        items.push({
          title: itemMatch[1],
          url: itemMatch[2],
          source: currentSource,
          fetched_at: new Date().toISOString(),
          _platform: platform,
          platform,
        })
      }
    }
    return items
  } catch { return [] }
}

function getSocialMdFiles(): string[] {
  try {
    const dir = socialDir()
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => /^\d{4}-\d{2}-\d{2}-(youtube|weibo|tech|custom)\.md$/.test(f))
      .sort()
      .reverse()
  } catch { return [] }
}

// ========== RSS feeds CRUD ==========

export function getFeeds(): CustomFeed[] {
  try {
    const filePath = customFeedsFile()
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(filePath)) return []
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CustomFeed[]
  } catch { return [] }
}

function saveFeeds(feeds: CustomFeed[]): void {
  const filePath = customFeedsFile()
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(feeds, null, 2), 'utf-8')
}

export function addFeed(name: string, url: string): CustomFeed {
  const feeds = getFeeds()
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  try { new URL(url) } catch { throw new Error('URL 格式无效') }
  if (feeds.some(f => f.url === url)) throw new Error('该 RSS 源已存在')
  const feed: CustomFeed = { id, name, url, createdAt: new Date().toISOString(), enabled: true }
  feeds.push(feed)
  saveFeeds(feeds)
  return feed
}

export function removeFeed(id: string): boolean {
  const before = getFeeds()
  const after = before.filter(f => f.id !== id)
  if (after.length === before.length) throw new Error('RSS 源不存在')
  saveFeeds(after)
  return true
}

export function toggleFeed(id: string): CustomFeed {
  const feeds = getFeeds()
  const feed = feeds.find(f => f.id === id)
  if (!feed) throw new Error('RSS 源不存在')
  feed.enabled = !feed.enabled
  saveFeeds(feeds)
  return feed
}

// ========== RSS parsing ==========

function httpGet(url: string, timeout = 15): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'https:' ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 RSS Reader' }, timeout: timeout * 1000 }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeout).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c as Buffer))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.on('error', reject)
  })
}

function parseRSS(xml: string, sourceName: string): RawItem[] {
  const items: RawItem[] = []
  const entryRe = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi
  let match: RegExpExecArray | null
  while ((match = entryRe.exec(xml)) !== null) {
    const entry = match[1]
    const get = (tag: string) => {
      const m = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(entry)
      if (!m) return ''
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim()
    }
    const title = get('title')
    const link = get('link')
    const description = get('description') || get('summary') || get('content')
    if (title) {
      items.push({
        title,
        url: link,
        description: description ? description.slice(0, 200) : '',
        source: sourceName,
      })
    }
  }
  return items
}

async function fetchFeed(feed: CustomFeed): Promise<RawItem[]> {
  const xml = await httpGet(feed.url)
  return parseRSS(xml, feed.name)
}

export async function collectCustomFeeds(): Promise<{ results: Record<string, unknown>; total: number }> {
  const feeds = getFeeds().filter(f => f.enabled)
  if (!feeds.length) return { results: {}, total: 0 }

  const dateStr = new Date().toISOString().slice(0, 10)
  const results: Record<string, unknown> = {}
  let total = 0
  const allItems: RawItem[] = []

  for (const feed of feeds) {
    try {
      const items = await fetchFeed(feed)
      const enriched = items.map(i => ({ ...i, fetched_at: new Date().toISOString(), platform: 'custom' }))
      allItems.push(...enriched)
      results[feed.id] = { success: true, saved: items.length, name: feed.name }
      total += items.length
    } catch (e) {
      results[feed.id] = { success: false, error: (e as Error).message, name: feed.name }
    }
  }

  if (allItems.length > 0) {
    writeItemsMd(dateStr, 'custom', allItems)
  }

  return { results, total }
}

export function getStatus(): SocialStatus {
  let rsshubStatus: SocialStatus['rsshubStatus'] = 'unknown'
  try {
    const out = execSync('docker ps --filter name=rsshub --format "{{.Status}}"', { timeout: 5000 }).toString().trim()
    rsshubStatus = out.includes('Up') ? 'running' : 'stopped'
  } catch { rsshubStatus = 'error' }

  let lastRun: string | null = null
  try {
    const sf = stateFile()
    if (fs.existsSync(sf)) {
      const state = JSON.parse(fs.readFileSync(sf, 'utf-8')) as { lastRun?: string }
      lastRun = state.lastRun || null
    }
  } catch { /* ignore */ }

  const platformLastItems: Record<string, { date?: string }> = {}
  for (const file of getSocialMdFiles()) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/)
    if (!match) continue
    const [, date, platform] = match
    if (!platformLastItems[platform]) {
      platformLastItems[platform] = { date: `${date}T00:00:00.000Z` }
    }
  }

  return { rsshubStatus, lastRun, platformLastItems }
}

interface GetItemsParams { platform?: string; page?: number; pageSize?: number }

export async function getItems({ platform, page = 1, pageSize = 20 }: GetItemsParams): Promise<SocialItemListResponse> {
  const allItems: SocialItem[] = []
  for (const file of getSocialMdFiles()) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/)
    if (!match) continue
    const [, , p] = match
    if (platform && platform !== 'all' && p !== platform) continue
    const items = parseItemsMd(path.join(socialDir(), file))
    allItems.push(...items.map(i => ({ ...i, _platform: p })))
  }

  allItems.sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())

  const total = allItems.length
  const start = (page - 1) * pageSize
  const data = allItems.slice(start, start + pageSize)

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function collect(platform = 'all'): Promise<Record<string, unknown>> {
  const targets = platform === 'all' ? ['youtube', 'weibo', 'tech'] : [platform]
  const results: Record<string, unknown> = {}
  const dateStr = new Date().toISOString().slice(0, 10)

  for (const target of targets) {
    try {
      const script = collectorScript()
      const cmd = `python3 ${script} ${target}`
      execSync(cmd, { timeout: 120000, cwd: path.dirname(script) })

      const platformDir = path.join(socialDir(), target)
      const latestFile = fs.existsSync(platformDir)
        ? fs.readdirSync(platformDir).filter(f => f.endsWith('.jsonl')).sort().reverse()[0]
        : null

      const items: RawItem[] = []
      if (latestFile) {
        const lines = fs.readFileSync(path.join(platformDir, latestFile), 'utf-8').trim().split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try { items.push(JSON.parse(line)) } catch { /* ignore malformed */ }
        }
      }

      if (items.length > 0) writeItemsMd(dateStr, target, items)
      results[target] = { success: true, saved: items.length }
    } catch (e) {
      const err = (e as { stderr?: Buffer; message: string }).stderr
        ? (e as { stderr: Buffer }).stderr.toString()
        : (e as Error).message
      results[target] = { success: false, error: err }
    }
  }

  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ lastRun: new Date().toISOString(), results }, null, 2), 'utf-8')
  } catch { /* ignore */ }

  return results
}
