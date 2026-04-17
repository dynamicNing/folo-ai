#!/usr/bin/env node
/**
 * 克隆或更新 content-archive 仓库到本地，用于离线调试 / social 存档路径。
 * 默认目录: ./content-archive （与 .env 的 CONTENT_ARCHIVE_DIR 对应）
 * 用法: node scripts/pull-archive.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGET = process.env.CONTENT_ARCHIVE_DIR || path.join(__dirname, '../content-archive');
const REPO = 'https://github.com/dynamicNing/content-archive.git';

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd });
}

if (fs.existsSync(path.join(TARGET, '.git'))) {
  console.log(`📦 更新已有仓库: ${TARGET}`);
  run('git pull --ff-only', TARGET);
} else {
  console.log(`📥 克隆到: ${TARGET}`);
  run(`git clone ${REPO} "${TARGET}"`);
}
console.log('\n✅ 完成。若要让后端读取此目录，请在 .env 设置:');
console.log(`   CONTENT_ARCHIVE_DIR=${TARGET}`);
