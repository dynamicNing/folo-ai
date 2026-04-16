const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { processChanges, syncAll } = require('../services/contentPipeline');
const auth = require('../middleware/auth');

// Simple in-memory queue to avoid concurrent processing
let processing = false;
const queue = [];

async function drainQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  while (queue.length > 0) {
    const job = queue.shift();
    try {
      await processChanges(job);
    } catch (err) {
      console.error('[webhook] job failed:', err.message);
    }
  }
  processing = false;
}

// GitHub Webhook — verify HMAC-SHA256 signature then enqueue
router.post('/github', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['x-hub-signature-256'];
    if (!sig) return res.status(401).json({ error: 'Missing signature' });
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // Respond immediately — GitHub expects < 10s
  res.json({ ok: true });

  const event = req.headers['x-github-event'];
  if (event !== 'push') return;

  let payload;
  try { payload = JSON.parse(req.body); } catch { return; }

  const added = [], modified = [], removed = [];
  for (const commit of payload.commits || []) {
    added.push(...(commit.added || []));
    modified.push(...(commit.modified || []));
    removed.push(...(commit.removed || []));
  }

  if (added.length + modified.length + removed.length === 0) return;

  console.log(`[webhook] push: +${added.length} ~${modified.length} -${removed.length}`);
  queue.push({ added, modified, removed });
  drainQueue();
});

// Admin: full sync from scratch
router.post('/sync-all', auth, async (req, res) => {
  try {
    const result = await syncAll();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
