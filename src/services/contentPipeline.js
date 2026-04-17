const matter = require('gray-matter');
const { marked } = require('marked');
const db = require('./db');

marked.setOptions({ breaks: true, gfm: true });

const GITHUB_OWNER = 'dynamicNing';
const GITHUB_REPO = 'content-archive';
const GITHUB_BRANCH = 'master';
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

// ── GitHub helpers ──────────────────────────────────────────────────────────

function githubHeaders() {
  const h = { 'User-Agent': 'folo-ai', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function fetchRawContent(repoPath) {
  const res = await fetch(`${GITHUB_RAW}/${repoPath}`, { headers: githubHeaders() });
  if (!res.ok) throw new Error(`GitHub raw fetch failed: ${res.status} ${repoPath}`);
  return res.text();
}

async function fetchFileMeta(repoPath) {
  const res = await fetch(`${GITHUB_API}/contents/${repoPath}`, { headers: githubHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return { sha: data.sha };
}

async function fetchAllMdFiles() {
  const res = await fetch(`${GITHUB_API}/git/trees/${GITHUB_BRANCH}?recursive=1`, { headers: githubHeaders() });
  if (!res.ok) throw new Error(`GitHub tree fetch failed: ${res.status}`);
  const { tree } = await res.json();
  return tree
    .filter(f => f.type === 'blob' && f.path.endsWith('.md') && !f.path.startsWith('_') && f.path.toLowerCase() !== 'readme.md')
    .map(f => ({ path: f.path, sha: f.sha }));
}

// ── Field extraction helpers ────────────────────────────────────────────────

function dateFromSlug(slug) {
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function titleFromBody(body, slug) {
  const m = body.match(/^#\s+(.+)$/m);
  if (!m) return slug;
  return m[1].replace(/^[\s\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/u, '').trim() || slug;
}

function summaryFromBody(body) {
  for (const line of body.split('\n')) {
    const clean = line.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim();
    if (clean.length > 30 && !clean.startsWith('📅') && !clean.startsWith('---')) {
      return clean.length > 150 ? clean.slice(0, 150) + '…' : clean;
    }
  }
  return '';
}

function categoryFromPath(repoPath) {
  const parts = repoPath.split('/');
  // social/weibo/... → social, ai-digest/... → ai-digest, root file → uncategorized
  if (parts.length === 1) return 'uncategorized';
  if (parts[0] === 'social') return parts.slice(0, 2).join('/'); // e.g. social/weibo
  return parts[0];
}

function slugFromPath(repoPath) {
  // Use full path (without .md) to avoid slug collisions across categories
  return repoPath.replace(/\.md$/, '');
}

// ── MiniMax AI ──────────────────────────────────────────────────────────────

async function aiSummarize(body, missingFields) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.warn('[pipeline] MINIMAX_API_KEY not set, skipping AI');
    return {};
  }

  const truncated = body.slice(0, 3000);
  const prompt = `你是一个内容处理助手。分析以下 Markdown 文章内容，为缺失字段生成值。

需要生成的字段：${missingFields.join(', ')}

字段说明：
- title: 文章标题，简洁准确，不超过30字
- tags: 内容标签数组，3-5个，如 ["AI","工具","周报"]
- summary: 文章摘要，100-150字，客观描述核心内容

文章内容：
${truncated}

请严格返回 JSON，只包含需要生成的字段，例如：
{"title":"...","tags":["a","b"],"summary":"..."}`;

  try {
    const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`MiniMax API error: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[pipeline] AI error:', err.message);
    return {};
  }
}

// ── Core processing ─────────────────────────────────────────────────────────

async function processFile({ path: repoPath, sha }) {
  const slug = slugFromPath(repoPath);
  const category = categoryFromPath(repoPath);

  // Skip if SHA unchanged (already processed)
  const existing = db.prepare('SELECT sha FROM articles WHERE slug = ?').get(slug);
  if (existing?.sha === sha) {
    console.log(`[pipeline] skip (unchanged): ${repoPath}`);
    return;
  }

  console.log(`[pipeline] processing: ${repoPath}`);
  const raw = await fetchRawContent(repoPath);
  const { data: meta, content: body } = matter(raw);

  // Determine which fields need AI generation
  const missingFields = [];
  if (!meta.title) missingFields.push('title');
  if (!meta.tags || !meta.tags.length) missingFields.push('tags');
  if (!meta.summary) missingFields.push('summary');

  let aiResult = {};
  if (missingFields.length > 0) {
    aiResult = await aiSummarize(body, missingFields);
  }

  // Merge: frontmatter > filename rule > AI result > fallback
  const title = meta.title || aiResult.title || titleFromBody(body, slug);
  const tags = (meta.tags?.length ? meta.tags : aiResult.tags) || [];
  const summary = meta.summary || aiResult.summary || summaryFromBody(body);
  const slugDate = dateFromSlug(slug);
  const date = meta.date
    ? new Date(meta.date).toISOString()
    : slugDate ? new Date(slugDate).toISOString() : new Date().toISOString();
  const status = meta.status || (slugDate ? 'published' : 'draft');
  const content = marked(body);
  const aiFields = missingFields.filter(f => aiResult[f]);

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
  );

  console.log(`[pipeline] saved: ${slug} (ai_fields: ${aiFields.join(',') || 'none'})`);
}

async function removeFile(repoPath) {
  const slug = slugFromPath(repoPath);
  db.prepare('DELETE FROM articles WHERE slug = ?').run(slug);
  console.log(`[pipeline] removed: ${slug}`);
}

// ── Public API ───────────────────────────────────────────────────────────────

async function processChanges({ added = [], modified = [], removed = [] }) {
  const mdFiles = [...added, ...modified].filter(p => p.endsWith('.md') && !p.startsWith('_') && p.toLowerCase() !== 'readme.md');
  const removedMd = removed.filter(p => p.endsWith('.md'));

  for (const repoPath of removedMd) {
    await removeFile(repoPath);
  }

  // Fetch SHAs then process sequentially to avoid rate limits
  for (const repoPath of mdFiles) {
    try {
      const meta = await fetchFileMeta(repoPath);
      await processFile({ path: repoPath, sha: meta?.sha || null });
    } catch (err) {
      console.error(`[pipeline] failed: ${repoPath}`, err.message);
    }
  }
}

async function syncAll() {
  console.log('[pipeline] starting full sync...');
  const files = await fetchAllMdFiles();
  console.log(`[pipeline] found ${files.length} md files`);
  let done = 0;
  for (const file of files) {
    try {
      await processFile(file);
      done++;
    } catch (err) {
      console.error(`[pipeline] syncAll failed: ${file.path}`, err.message);
    }
  }
  console.log(`[pipeline] full sync done: ${done}/${files.length}`);
  return { total: files.length, processed: done };
}

module.exports = { processChanges, syncAll };
