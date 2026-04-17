#!/usr/bin/env node
/**
 * 清空本地 SQLite 数据库（articles.db），重新建表。
 * 用法: node scripts/reset-db.js [--yes]
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '../data/articles.db');

async function confirm() {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`⚠️  将删除 ${DB_PATH}，继续？(y/N) `, ans => {
      rl.close();
      resolve(/^y(es)?$/i.test(ans.trim()));
    });
  });
}

(async () => {
  if (!(await confirm())) {
    console.log('已取消');
    process.exit(0);
  }
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`🗑  已删除: ${DB_PATH}`);
  } else {
    console.log('ℹ️  数据库不存在，跳过删除');
  }
  // 重新 require db.js 触发建表
  require('../src/services/db');
  console.log('✅ 已重建空库，运行 `npm run sync` 导入内容');
})();
