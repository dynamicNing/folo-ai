/**
 * 社交媒体采集服务
 * 扁平化 md 存档格式: social/YYYY-MM-DD-{platform}.md
 */

const { execSync } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const CONTENT_ARCHIVE_DIR = process.env.CONTENT_ARCHIVE_DIR || '/root/content-archive';
const SOCIAL_DIR = path.join(CONTENT_ARCHIVE_DIR, 'social');
const COLLECTOR_SCRIPT = process.env.COLLECTOR_SCRIPT || '/root/.openclaw/workspace/skills/social-media-collector/scripts/collector.py';
const STATE_FILE = path.join(SOCIAL_DIR, '.collector-state.json');
const CUSTOM_FEEDS_FILE = path.join(__dirname, '../../data/custom-feeds.json');

// 平台 emoji/name 映射
const PLATFORM_META = {
  youtube: { emoji: '▶️', name: 'YouTube' },
  weibo:   { emoji: '🐦', name: '微博热搜' },
  tech:    { emoji: '📰', name: '科技资讯' },
  custom:  { emoji: '📡', name: '自定义RSS' },
};

// 平台对应的 collector.py 参数
const PLATFORM_PARAM = {
  youtube: 'youtube', weibo: 'weibo', tech: 'tech',
};

// ========== 通用存档读写（md 格式）==========

function writeItemsMd(dateStr, platform, sourceGroups, items) {
  // items: array of { title, url, source, description }
  fs.mkdirSync(SOCIAL_DIR, { recursive: true });
  const outPath = path.join(SOCIAL_DIR, `${dateStr}-${platform}.md`);

  const lines = [`# 🐦 社交媒体采集 · ${dateStr}`, ''];
  const grouped = {};
  for (const item of items) {
    const src = item.source || platform;
    if (!grouped[src]) grouped[src] = [];
    grouped[src].push(item);
  }

  for (const [src, srcItems] of Object.entries(grouped)) {
    const meta = PLATFORM_META[platform] || { emoji: '📌', name: platform };
    lines.push(`## ${meta.emoji} ${src}`);
    for (const item of srcItems) {
      const title = item.title || '(无标题)';
      const url = item.url || '';
      const desc = item.description ? ` — ${item.description.slice(0, 60)}` : '';
      if (url) {
        lines.push(`- [${title}](${url})${desc}`);
      } else {
        lines.push(`- ${title}${desc}`);
      }
    }
    lines.push('');
  }

  lines.push(`> 采集时间: ${new Date().toLocaleString('zh-CN')} | 共 ${items.length} 条`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  return outPath;
}

// 从 md 文件解析出 items
function parseItemsMd(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const dateMatch = path.basename(filePath).match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    const platform = dateMatch ? dateMatch[2] : '';
    const lines = content.split('\n');
    const items = [];
    let currentSource = platform;

    for (const line of lines) {
      const sectionMatch = line.match(/^## \S+ (.+)/);
      if (sectionMatch) { currentSource = sectionMatch[1]; continue; }
      const itemMatch = line.match(/^\- \[(.+?)\]\((https?:\/\/[^\)]+)\)\)/);
      if (itemMatch) {
        items.push({ title: itemMatch[1], url: itemMatch[2], source: currentSource, fetched_at: new Date().toISOString(), _platform: platform, _date: dateStr });
      }
    }
    return items;
  } catch { return []; }
}

// 获取某日期某平台的文件路径
function mdPath(dateStr, platform) {
  return path.join(SOCIAL_DIR, `${dateStr}-${platform}.md`);
}

// 获取所有 social/*.md 文件（按日期倒序）
function getSocialMdFiles() {
  try {
    if (!fs.existsSync(SOCIAL_DIR)) return [];
    return fs.readdirSync(SOCIAL_DIR)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}-(youtube|weibo|tech|custom)\.md$/))
      .sort()
      .reverse();
  } catch { return []; }
}

// ========== 自定义 RSS 源管理 ==========

function getFeeds() {
  try {
    const dir = path.dirname(CUSTOM_FEEDS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(CUSTOM_FEEDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CUSTOM_FEEDS_FILE, 'utf-8'));
  } catch { return []; }
}

function saveFeeds(feeds) {
  const dir = path.dirname(CUSTOM_FEEDS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOM_FEEDS_FILE, JSON.stringify(feeds, null, 2), 'utf-8');
}

function addFeed(name, url) {
  const feeds = getFeeds();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try { new URL(url); } catch { throw new Error('URL 格式无效'); }
  if (feeds.some(f => f.url === url)) throw new Error('该 RSS 源已存在');
  feeds.push({ id, name, url, createdAt: new Date().toISOString(), enabled: true });
  saveFeeds(feeds);
  return feeds[feeds.length - 1];
}

function removeFeed(id) {
  const feeds = getFeeds().filter(f => f.id !== id);
  if (feeds.length === getFeeds().length) throw new Error('RSS 源不存在');
  saveFeeds(feeds);
  return true;
}

function toggleFeed(id) {
  const feeds = getFeeds();
  const feed = feeds.find(f => f.id === id);
  if (!feed) throw new Error('RSS 源不存在');
  feed.enabled = !feed.enabled;
  saveFeeds(feeds);
  return feed;
}

// ========== 轻量 RSS 解析器 ==========

function httpGet(url, timeout = 15) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 RSS Reader' }, timeout: timeout * 1000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.on('error', reject);
  });
}

function parseRSS(xml, sourceName) {
  const items = [];
  const entryRe = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  while ((match = entryRe.exec(xml)) !== null) {
    const entry = match[1];
    const get = (tag) => {
      const m = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(entry);
      if (!m) return '';
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim();
    };
    const title = get('title');
    const link = get('link');
    const description = get('description') || get('summary') || get('content');
    const pubDate = get('pubDate') || get('published') || get('updated') || '';
    if (title) {
      items.push({ title, url: link, description: description ? description.slice(0, 200) : '', published: pubDate, source: sourceName });
    }
  }
  return items;
}

async function fetchFeed(feed) {
  const xml = await httpGet(feed.url);
  return parseRSS(xml, feed.name);
}

// ========== 核心采集逻辑 ==========

async function collectCustomFeeds() {
  const feeds = getFeeds().filter(f => f.enabled);
  if (!feeds.length) return { results: {}, total: 0 };

  const dateStr = new Date().toISOString().slice(0, 10);
  const results = {};
  let total = 0;
  const allItems = [];

  for (const feed of feeds) {
    try {
      const items = await fetchFeed(feed);
      const enriched = items.map(i => ({ ...i, fetched_at: new Date().toISOString(), platform: 'custom' }));
      allItems.push(...enriched);
      results[feed.id] = { success: true, saved: items.length, name: feed.name };
      total += items.length;
    } catch (e) {
      results[feed.id] = { success: false, error: e.message, name: feed.name };
    }
  }

  if (allItems.length > 0) {
    writeItemsMd(dateStr, 'custom', {}, allItems);
  }

  return { results, total };
}

// 获取采集状态
function getStatus() {
  let rsshubStatus = 'unknown';
  try {
    const out = execSync('docker ps --filter name=rsshub --format "{{.Status}}"', { timeout: 5000 }).toString().trim();
    rsshubStatus = out.includes('Up') ? 'running' : 'stopped';
  } catch { rsshubStatus = 'error'; }

  let lastRun = null;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      lastRun = state.lastRun || null;
    }
  } catch { /* ignore */ }

  // 各平台最新一条的日期
  const platformLastItems = {};
  const files = getSocialMdFiles();
  for (const file of files) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    if (!match) continue;
    const [, date, platform] = match;
    if (!platformLastItems[platform]) {
      platformLastItems[platform] = { date: `${date}T00:00:00.000Z`, source: PLATFORM_META[platform]?.name || platform };
    }
  }

  return { rsshubStatus, lastRun, platformLastItems };
}

// 读取内容列表
async function getItems({ platform, page = 1, pageSize = 20 }) {
  const allItems = [];
  const files = getSocialMdFiles();

  for (const file of files) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    if (!match) continue;
    const [, dateStr, p] = match;
    if (platform && platform !== 'all' && p !== platform) continue;
    const items = parseItemsMd(path.join(SOCIAL_DIR, file));
    allItems.push(...items.map(i => ({ ...i, _platform: p, _date: dateStr })));
  }

  allItems.sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at));

  const total = allItems.length;
  const start = (page - 1) * pageSize;
  const data = allItems.slice(start, start + pageSize);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// 触发固定来源采集
async function collect(platform = 'all') {
  const targets = platform === 'all'
    ? ['youtube', 'weibo', 'tech']
    : [platform];

  const results = {};
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const target of targets) {
    try {
      const cmd = `python3 ${COLLECTOR_SCRIPT} ${target}`;
      const out = execSync(cmd, { timeout: 120, cwd: path.dirname(COLLECTOR_SCRIPT) }).toString().trim();

      // 解析 collector.py 的 JSONL 输出，提取 items
      const platformDir = path.join(SOCIAL_DIR, target);
      const latestFile = fs.existsSync(platformDir)
        ? fs.readdirSync(platformDir).filter(f => f.endsWith('.jsonl')).sort().reverse()[0]
        : null;

      let items = [];
      if (latestFile) {
        const lines = fs.readFileSync(path.join(platformDir, latestFile), 'utf-8').trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try { items.push(JSON.parse(line)); } catch {}
        }
      }

      // 写入 md 存档
      if (items.length > 0) {
        writeItemsMd(dateStr, target, {}, items);
      }

      results[target] = { success: true, saved: items.length };
    } catch (e) {
      const err = e.stderr ? e.stderr.toString() : e.message;
      results[target] = { success: false, error: err };
    }
  }

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastRun: new Date().toISOString(), results }, null, 2), 'utf-8');
  } catch { /* ignore */ }

  return results;
}

async function collectCustom() {
  return collectCustomFeeds();
}

module.exports = {
  getStatus, getItems, collect, collectCustom,
  getFeeds, addFeed, removeFeed, toggleFeed,
};
