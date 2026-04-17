#!/usr/bin/env tsx
/**
 * 本地一键同步：从 GitHub content-archive 拉取所有 md 入库。
 * 用法: npm run sync  (== tsx scripts/sync.ts)
 */
import 'dotenv/config'
import { syncAll } from '../server/utils/contentPipeline'

async function main(): Promise<void> {
  try {
    const result = await syncAll()
    console.log('\n✅ 同步完成:', result)
    process.exit(0)
  } catch (err) {
    console.error('\n❌ 同步失败:', (err as Error).message)
    process.exit(1)
  }
}

main()
