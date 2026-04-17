const express = require('express');
const router = express.Router();
const { collect, getStatus, getItems } = require('../services/collector');
const auth = require('../middleware/auth');

// 公开：采集状态（RSSHub + 最近采集时间）
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 公开：社交媒体内容列表（支持平台/分页过滤）
router.get('/items', async (req, res) => {
  try {
    const { platform, page = 1, pageSize = 20 } = req.query;
    const result = await getItems({ platform, page: parseInt(page), pageSize: parseInt(pageSize) });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 鉴权：触发采集
router.post('/collect', auth, async (req, res) => {
  try {
    const { platform } = req.body; // youtube | weibo | tech | all
    const result = await collect(platform);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
