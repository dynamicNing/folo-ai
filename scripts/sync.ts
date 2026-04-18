#!/usr/bin/env tsx
/**
 * 本地一键同步：从 GitHub content-archive 拉取所有 md 入库。
 * 用法: npm run sync  (== tsx scripts/sync.ts)
 */
import 'dotenv/config'
import { syncAll } from '../server/utils/contentPipeline'
import { startSyncLog, finishSyncLog } from '../server/utils/syncLog'

async function main(): Promise<void> {
  const logId = startSyncLog({ source: 'cli' })
  try {
    const result = await syncAll()
    finishSyncLog(logId, {
      status: result.failed > 0 ? 'partial' : 'success',
      total: result.total,
      processed: result.processed,
      failed: result.failed,
      detail: { errors: result.errors },
    })
    console.log('\n✅ 同步完成:', result)
    process.exit(0)
  } catch (err) {
    const msg = (err as Error).message
    finishSyncLog(logId, { status: 'failed', message: msg })
    console.error('\n❌ 同步失败:', msg)
    process.exit(1)
  }
}

main()
