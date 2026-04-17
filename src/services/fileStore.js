const db = require('./db');

function list(filters = {}) {
  let sql = 'SELECT slug, category, title, tags, date, summary, status, updated_at FROM articles WHERE 1=1';
  const params = [];

  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters.category) { sql += ' AND category = ?'; params.push(filters.category); }
  if (filters.tag) { sql += ' AND json_each.value = ?'; /* handled below */ }

  sql += ' ORDER BY date DESC, updated_at DESC';

  let items = db.prepare(sql).all(...params);

  // Parse tags JSON and filter by tag if needed
  items = items.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }));

  if (filters.tag) {
    items = items.filter(i => i.tags.includes(filters.tag));
  }

  const page = Math.max(1, parseInt(filters.page) || 1);
  const pageSize = parseInt(filters.pageSize) || 20;
  const total = items.length;
  const data = items.slice((page - 1) * pageSize, page * pageSize);

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

function get(slug) {
  const row = db.prepare('SELECT * FROM articles WHERE slug = ?').get(slug);
  if (!row) return null;
  return { ...row, tags: JSON.parse(row.tags || '[]'), ai_fields: JSON.parse(row.ai_fields || '[]') };
}

function updateStatus(slug, status) {
  const VALID = ['draft', 'published', 'archived'];
  if (!VALID.includes(status)) throw new Error('Invalid status');
  const result = db.prepare('UPDATE articles SET status = ?, updated_at = ? WHERE slug = ?')
    .run(status, new Date().toISOString(), slug);
  return result.changes > 0;
}

function remove(slug) {
  const result = db.prepare('DELETE FROM articles WHERE slug = ?').run(slug);
  return result.changes > 0;
}

function categories() {
  const rows = db.prepare('SELECT DISTINCT category FROM articles').all();
  return rows.map(r => r.category).filter(Boolean);
}

module.exports = { list, get, updateStatus, remove, categories };
