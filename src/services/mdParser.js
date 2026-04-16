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

function parse(filePath, contentDir) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: meta, content: body } = matter(raw);
  const slug = slugFromPath(filePath);
  const category = categoryFromPath(filePath, contentDir);

  return {
    slug,
    category,
    title: meta.title || slug,
    summary: meta.summary || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    status: meta.status || 'draft',
    date: meta.date ? new Date(meta.date).toISOString() : null,
    content: marked(body),
    filePath,
  };
}

function parseMeta(filePath, contentDir) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data: meta } = matter(raw);
  const slug = slugFromPath(filePath);
  const category = categoryFromPath(filePath, contentDir);

  return {
    slug,
    category,
    title: meta.title || slug,
    summary: meta.summary || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    status: meta.status || 'draft',
    date: meta.date ? new Date(meta.date).toISOString() : null,
    filePath,
  };
}

module.exports = { parse, parseMeta, slugFromPath };
