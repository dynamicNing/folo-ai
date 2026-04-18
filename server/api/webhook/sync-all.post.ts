import { syncAll } from '~/server/utils/contentPipeline'
import { apiError, requireAuth } from '~/server/utils/auth'
import { startSyncLog, finishSyncLog, type SyncSource } from '~/server/utils/syncLog'

export default defineEventHandler(async event => {
  requireAuth(event)
  const body = await readBody(event).catch(() => ({})) as { source?: SyncSource }
  const source: SyncSource = body?.source === 'cli' ? 'cli' : 'manual'

  const logId = startSyncLog({ source })
  try {
    const result = await syncAll()
    finishSyncLog(logId, {
      status: result.failed > 0 ? 'partial' : 'success',
      total: result.total,
      processed: result.processed,
      failed: result.failed,
      message: result.failed > 0 ? `${result.failed} 个文件失败` : null as unknown as string,
      detail: { errors: result.errors },
    })
    return { ok: true, logId, ...result }
  } catch (e) {
    const msg = (e as Error).message
    finishSyncLog(logId, { status: 'failed', message: msg })
    apiError(500, msg)
  }
})
