const express = require('express');
const router = express.Router();
const { collect, collectCustom, getStatus, getItems, getFeeds, addFeed, removeFeed, toggleFeed } = require('../services/collector');
const auth = require('../middleware/auth');

// 公开：采集状态
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 公开：社交媒体内容列表
router.get('/items', async (req, res) => {
  try {
    const { platform, page = 1, pageSize = 20 } = req.query;
    const result = await getItems({ platform, page: parseInt(page), pageSize: parseInt(pageSize) });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 鉴权：触发固定来源采集
router.post('/collect', auth, async (req, res) => {
  try {
    const { platform } = req.body; // youtube | weibo | tech | all
    const result = await collect(platform);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== 自定义 RSS 源管理 =====

// 公开：获取所有 RSS 源
router.get('/feeds', (req, res) => {
  try {
    res.json(getFeeds());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 鉴权：添加 RSS 源
router.post('/feeds', auth, (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name 和 url 均必填' });
    const feed = addFeed(name, url);
    res.json(feed);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 鉴权：删除 RSS 源
router.delete('/feeds/:id', auth, (req, res) => {
  try {
    removeFeed(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 鉴权：切换 RSS 源启用状态
router.patch('/feeds/:id/toggle', auth, (req, res) => {
  try {
    const feed = toggleFeed(req.params.id);
    res.json(feed);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 鉴权：采集自定义 RSS
router.post('/collect/custom', auth, async (req, res) => {
  try {
    const result = await collectCustom();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
