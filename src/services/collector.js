/**
 * 社交媒体采集服务
 * 读取本地 JSONL 存档 + 触发 RSSHub 采集
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SOCIAL_DIR = '/root/content-archive/social';
const COLLECTOR_SCRIPT = '/root/.openclaw/workspace/skills/social-media-collector/scripts/collector.py';
const STATE_FILE = path.join(SOCIAL_DIR, '.collector-state.json');

// 各平台路径
const PLATFORMS = {
  youtube: path.join(SOCIAL_DIR, 'youtube'),
  weibo: path.join(SOCIAL_DIR, 'weibo'),
  tech: path.join(SOCIAL_DIR, 'tech'),
};

// 获取采集状态
function getStatus() {
  // RSSHub Docker 状态
  let rsshubStatus = 'unknown';
  try {
    const out = execSync('docker ps --filter name=rsshub --format "{{.Status}}"', { timeout: 5000 }).toString().trim();
    rsshubStatus = out.includes('Up') ? 'running' : 'stopped';
  } catch {
    rsshubStatus = 'error';
  }

  // 最近采集时间
  let lastRun = null;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      lastRun = state.lastRun || null;
    }
  } catch { /* ignore */ }

  // 各平台最新一条时间
  const platformLastItems = {};
  for (const [name, dir] of Object.entries(PLATFORMS)) {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort().reverse();
      if (files.length > 0) {
        const latest = files[0];
        const lines = fs.readFileSync(path.join(dir, latest), 'utf-8').trim().split('\n');
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

  // 按 fetch 时间倒序
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

// 触发采集
async function collect(platform = 'all') {
  const targets = platform === 'all'
    ? ['youtube', 'weibo', 'tech']
    : [platform];

  const results = {};

  for (const target of targets) {
    try {
      const cmd = `python3 ${COLLECTOR_SCRIPT} ${target}`;
      const out = execSync(cmd, { timeout: 120, cwd: path.dirname(COLLECTOR_SCRIPT) }).toString().trim();

      // 解析输出中的采集数量
      const savedMatch = out.match(/已保存 (\d+) 条/);
      const saved = savedMatch ? parseInt(savedMatch[1]) : 0;

      results[target] = { success: true, saved, output: out };
    } catch (e) {
      const err = e.stderr ? e.stderr.toString() : e.message;
      results[target] = { success: false, error: err };
    }
  }

  // 更新状态文件
  try {
    const state = { lastRun: new Date().toISOString(), results };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* ignore */ }

  return results;
}

module.exports = { getStatus, getItems, collect };
