/**
 * 社交媒体采集服务
 * 读取本地 JSONL 存档 + 触发 RSSHub 采集 + 自定义 RSS 源
 */

const { execSync } = require('child_process');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const SOCIAL_DIR = '/root/content-archive/social';
const COLLECTOR_SCRIPT = '/root/.openclaw/workspace/skills/social-media-collector/scripts/collector.py';
const STATE_FILE = path.join(SOCIAL_DIR, '.collector-state.json');
const CUSTOM_DIR = path.join(SOCIAL_DIR, 'custom');
const CUSTOM_FEEDS_FILE = path.join(__dirname, '../../data/custom-feeds.json');

// 各平台路径
const PLATFORMS = {
  youtube: path.join(SOCIAL_DIR, 'youtube'),
  weibo: path.join(SOCIAL_DIR, 'weibo'),
  tech: path.join(SOCIAL_DIR, 'tech'),
  custom: CUSTOM_DIR,
};

// ========== 自定义 RSS 源管理 ==========

function getFeeds() {
  try {
    const dir = path.dirname(CUSTOM_FEEDS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(CUSTOM_FEEDS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CUSTOM_FEEDS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveFeeds(feeds) {
  const dir = path.dirname(CUSTOM_FEEDS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CUSTOM_FEEDS_FILE, JSON.stringify(feeds, null, 2), 'utf-8');
}

function addFeed(name, url) {
  const feeds = getFeeds();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  // 简单验证 URL 格式
  try { new URL(url); } catch { throw new Error('URL 格式无效'); }
  // 避免重复
  if (feeds.some(f => f.url === url)) {
    throw new Error('该 RSS 源已存在');
  }
  feeds.push({ id, name, url, createdAt: new Date().toISOString(), enabled: true });
  saveFeeds(feeds);
  return { id, name, url, createdAt: feeds[feeds.length - 1].createdAt, enabled: true };
}

function removeFeed(id) {
  const feeds = getFeeds();
  const idx = feeds.findIndex(f => f.id === id);
  if (idx === -1) throw new Error('RSS 源不存在');
  feeds.splice(idx, 1);
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
  // 匹配 <item> 或 <entry>
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
    const pubDate = get('pubDate') || get('published') || get('updated') || get('dc:date') || '';
    const author = get('author') || get('dc:creator') || sourceName;
    if (title) {
      items.push({ title, url: link, description: description.slice(0, 300), published: pubDate, source: sourceName, platform: 'custom' });
    }
  }
  return items;
}

async function fetchFeed(feed) {
  const xml = await httpGet(feed.url);
  const items = parseRSS(xml, feed.name);
  return { feedId: feed.id, feedName: feed.name, items, saved: items.length };
}

// ========== 核心采集逻辑 ==========

async function collectCustomFeeds() {
  const feeds = getFeeds().filter(f => f.enabled);
  if (!feeds.length) return { results: {}, total: 0 };

  const results = {};
  let total = 0;
  fs.mkdirSync(CUSTOM_DIR, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);

  for (const feed of feeds) {
    try {
      const { items } = await fetchFeed(feed);
      if (items.length > 0) {
        const outPath = path.join(CUSTOM_DIR, `${dateStr}.jsonl`);
        const lines = items.map(i => JSON.stringify({ ...i, fetched_at: new Date().toISOString() })).join('\n') + '\n';
        fs.appendFileSync(outPath, lines, 'utf-8');
      }
      results[feed.id] = { success: true, saved: items.length, name: feed.name };
      total += items.length;
    } catch (e) {
      results[feed.id] = { success: false, error: e.message, name: feed.name };
    }
  }
  return { results, total };
}

// 获取采集状态
function getStatus() {
  let rsshubStatus = 'unknown';
  try {
    const out = execSync('docker ps --filter name=rsshub --format "{{.Status}}"', { timeout: 5000 }).toString().trim();
    rsshubStatus = out.includes('Up') ? 'running' : 'stopped';
  } catch {
    rsshubStatus = 'error';
  }

  let lastRun = null;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      lastRun = state.lastRun || null;
    }
  } catch { /* ignore */ }

  const platformLastItems = {};
  for (const [name, dir] of Object.entries(PLATFORMS)) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort().reverse();
      if (files.length > 0) {
        const latest = files[0];
        const lines = fs.readFileSync(path.join(dir, latest), 'utf-8').trim().split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const last = JSON.parse(lines[lines.length - 1]);
          platformLastItems[name] = { date: last.fetched_at, source: last.source };
        }
      }
    } catch { /* ignore */ }
  }

  return { rsshubStatus, lastRun, platformLastItems };
}

// 读取 JSONL 内容列表
async function getItems({ platform, page = 1, pageSize = 20 }) {
  const allItems = [];

  const dirs = platform && platform !== 'all'
    ? { [platform]: PLATFORMS[platform] }
    : PLATFORMS;

  for (const [name, dir] of Object.entries(dirs)) {
    try {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort().reverse();

      for (const file of files) {
        const lines = fs.readFileSync(path.join(dir, file), 'utf-8').trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            allItems.push({ ...item, _platform: name, _date: file.replace('.jsonl', '') });
          } catch { /* skip invalid lines */ }
        }
      }
    } catch { /* skip on error */ }
  }

  allItems.sort((a, b) => new Date(b.fetched_at) - new Date(a.fetched_at));

  const total = allItems.length;
  const start = (page - 1) * pageSize;
  const data = allItems.slice(start, start + pageSize);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// 触发采集（固定来源）
async function collect(platform = 'all') {
  const targets = platform === 'all'
    ? ['youtube', 'weibo', 'tech']
    : [platform];

  const results = {};

  for (const target of targets) {
    try {
      const cmd = `python3 ${COLLECTOR_SCRIPT} ${target}`;
      const out = execSync(cmd, { timeout: 120, cwd: path.dirname(COLLECTOR_SCRIPT) }).toString().trim();
      const savedMatch = out.match(/已保存 (\d+) 条/);
      const saved = savedMatch ? parseInt(savedMatch[1]) : 0;
      results[target] = { success: true, saved, output: out };
    } catch (e) {
      const err = e.stderr ? e.stderr.toString() : e.message;
      results[target] = { success: false, error: err };
    }
  }

  try {
    const state = { lastRun: new Date().toISOString(), results };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* ignore */ }

  return results;
}

// 触发自定义 RSS 采集
async function collectCustom() {
  return collectCustomFeeds();
}

module.exports = {
  getStatus, getItems, collect, collectCustom,
  getFeeds, addFeed, removeFeed, toggleFeed,
};
