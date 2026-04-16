const express = require('express');
const router = express.Router();
const store = require('../services/fileStore');
const auth = require('../middleware/auth');

// 公开：文章列表
router.get('/', (req, res) => {
  const { category, tag, status = 'published', page, pageSize } = req.query;
  // 管理员可查看任意状态
  const effectiveStatus = req.headers['authorization'] ? status : 'published';
  try {
    const result = store.list({ category, tag, status: effectiveStatus, page, pageSize });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 公开：分类列表
router.get('/categories', (req, res) => {
  res.json(store.categories());
});

// 公开：文章详情
router.get('/:slug', (req, res) => {
  const item = store.get(req.params.slug);
  if (!item) return res.status(404).json({ error: '文章不存在' });
  // 非管理员只能看 published
  if (!req.headers['authorization'] && item.status !== 'published') {
    return res.status(404).json({ error: '文章不存在' });
  }
  res.json(item);
});

// 鉴权：修改状态
router.patch('/:slug/status', auth, (req, res) => {
  const { status } = req.body;
  try {
    const ok = store.updateStatus(req.params.slug, status);
    if (!ok) return res.status(404).json({ error: '文章不存在' });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 鉴权：删除（移入回收站）
router.delete('/:slug', auth, (req, res) => {
  const ok = store.remove(req.params.slug);
  if (!ok) return res.status(404).json({ error: '文章不存在' });
  res.json({ ok: true });
});

// [预留] AI 采集接口
router.post('/collector/run', auth, async (req, res) => {
  res.status(501).json({ error: 'AI 采集模块尚未实现' });
});

router.get('/collector/config', auth, (req, res) => {
  res.status(501).json({ error: 'AI 采集模块尚未实现' });
});

router.put('/collector/config', auth, (req, res) => {
  res.status(501).json({ error: 'AI 采集模块尚未实现' });
});

module.exports = router;
