#!/usr/bin/env node
/**
 * 本地一键同步：从 GitHub content-archive 拉取所有 md 入库。
 * 用法: node scripts/sync.js
 */
require('dotenv').config();
const { syncAll } = require('../src/services/contentPipeline');

(async () => {
  try {
    const result = await syncAll();
    console.log('\n✅ 同步完成:', result);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 同步失败:', err.message);
    process.exit(1);
  }
})();
