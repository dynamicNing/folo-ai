const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { parse, parseMeta } = require('./mdParser');

const CONTENT_DIR = path.join(__dirname, '../../content');
const TRASH_DIR = path.join(CONTENT_DIR, '_trash');

function ensureTrash() {
  if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });
}

function getAllFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue; // skip _trash etc
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(full, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function list(filters = {}) {
  const files = getAllFiles(CONTENT_DIR);
  let items = files.map(f => parseMeta(f, CONTENT_DIR));

  if (filters.category) {
    items = items.filter(i => i.category === filters.category);
  }
  if (filters.tag) {
    items = items.filter(i => i.tags.includes(filters.tag));
  }
  if (filters.status) {
    items = items.filter(i => i.status === filters.status);
  }

  items.sort((a, b) => {
    const da = a.date ? new Date(a.date) : 0;
    const db = b.date ? new Date(b.date) : 0;
    return db - da;
  });

  // pagination
  const page = Math.max(1, parseInt(filters.page) || 1);
  const pageSize = parseInt(filters.pageSize) || 20;
  const total = items.length;
  const data = items.slice((page - 1) * pageSize, page * pageSize);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

function findFile(slug) {
  const files = getAllFiles(CONTENT_DIR);
  return files.find(f => path.basename(f, '.md') === slug) || null;
}

function get(slug) {
  const filePath = findFile(slug);
  if (!filePath) return null;
  return parse(filePath, CONTENT_DIR);
}

function updateStatus(slug, status) {
  const VALID = ['draft', 'published', 'archived'];
  if (!VALID.includes(status)) throw new Error('Invalid status');

  const filePath = findFile(slug);
  if (!filePath) return false;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  parsed.data.status = status;
  const updated = matter.stringify(parsed.content, parsed.data);
  fs.writeFileSync(filePath, updated, 'utf-8');
  return true;
}

function remove(slug) {
  ensureTrash();
  const filePath = findFile(slug);
  if (!filePath) return false;
  const dest = path.join(TRASH_DIR, path.basename(filePath));
  fs.renameSync(filePath, dest);
  return true;
}

function categories() {
  const files = getAllFiles(CONTENT_DIR);
  const cats = new Set(files.map(f => {
    const rel = path.relative(CONTENT_DIR, f);
    const parts = rel.split(path.sep);
    return parts.length > 1 ? parts[0] : 'uncategorized';
  }));
  return Array.from(cats);
}

module.exports = { list, get, updateStatus, remove, categories };
