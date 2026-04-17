#!/usr/bin/env tsx
/**
 * 克隆或更新 content-archive 仓库到本地，用于离线调试 / social 存档路径。
 * 默认目录: ./content-archive（与 .env 的 CONTENT_ARCHIVE_DIR 对应）
 * 用法: npm run archive:pull
 */
import 'dotenv/config'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const TARGET = process.env.CONTENT_ARCHIVE_DIR || path.resolve(process.cwd(), 'content-archive')
const REPO = 'https://github.com/dynamicNing/content-archive.git'

function run(cmd: string, cwd?: string): void {
  console.log(`$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd })
}

if (fs.existsSync(path.join(TARGET, '.git'))) {
  console.log(`📦 更新已有仓库: ${TARGET}`)
  run('git pull --ff-only', TARGET)
} else {
  console.log(`📥 克隆到: ${TARGET}`)
  run(`git clone ${REPO} "${TARGET}"`)
}
console.log('\n✅ 完成。若要让后端读取此目录，请在 .env 设置:')
console.log(`   CONTENT_ARCHIVE_DIR=${TARGET}`)
