const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

marked.setOptions({ breaks: true, gfm: true });

function slugFromPath(filePath) {
  return path.basename(filePath, '.md');
}

function categoryFromPath(filePath, contentDir) {
  const rel = path.relative(contentDir, filePath);
  const parts = rel.split(path.sep);
  return parts.length > 1 ? parts[0] : 'uncategorized';
}

// Extract date from YYYY-MM-DD filename pattern
function dateFromSlug(slug) {
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Extract plain title from first H1 heading (strip leading emoji/symbols)
function titleFromBody(body, slug) {
  const m = body.match(/^#\s+(.+)$/m);
  if (!m) return slug;
  return m[1].replace(/^[\s\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/u, '').trim() || slug;
}

// Extract first meaningful paragraph as summary
function summaryFromBody(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    const clean = line.replace(/^#+\s*/, '').replace(/[*_`>]/g, '').trim();
    if (clean.length > 30 && !clean.startsWith('📅') && !clean.startsWith('---')) {
      return clean.length > 120 ? clean.slice(0, 120) + '…' : clean;
    }
  }
  return '';
}

function resolveMeta(meta, slug, body) {
  const slugDate = dateFromSlug(slug);
  const date = meta.date ? new Date(meta.date).toISOString()
    : slugDate ? new Date(slugDate).toISOString() : null;
  const title = meta.title || titleFromBody(body, slug);
  const summary = meta.summary || summaryFromBody(body);
  // Default to published for date-named files (finalized dated reports)
  const status = meta.status || (slugDate ? 'published' : 'draft');
  const tags = Array.isArray(meta.tags) ? meta.tags : [];
  return { date, title, summary, status, tags };
}

function parse(filePath, contentDir) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: meta, content: body } = matter(raw);
  const slug = slugFromPath(filePath);
  const category = categoryFromPath(filePath, contentDir);
  const { date, title, summary, status, tags } = resolveMeta(meta, slug, body);

  return {
    slug,
    category,
    title,
    summary,
    tags,
    status,
    date,
    content: marked(body),
    filePath,
  };
}

function parseMeta(filePath, contentDir) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: meta, content: body } = matter(raw);
  const slug = slugFromPath(filePath);
  const category = categoryFromPath(filePath, contentDir);
  const { date, title, summary, status, tags } = resolveMeta(meta, slug, body);

  return {
    slug,
    category,
    title,
    summary,
    tags,
    status,
    date,
    filePath,
  };
}

module.exports = { parse, parseMeta, slugFromPath };
