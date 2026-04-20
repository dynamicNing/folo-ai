import crypto from 'node:crypto'
import { processChanges } from '~/server/utils/contentPipeline'
import { apiError } from '~/server/utils/auth'
import { startSyncLog, finishSyncLog } from '~/server/utils/syncLog'

interface Job { added: string[]; modified: string[]; removed: string[] }

let processing = false
const queue: Job[] = []

async function drainQueue() {
  if (processing || queue.length === 0) return
  processing = true
  while (queue.length > 0) {
    const job = queue.shift()!
    const logId = startSyncLog({
      source: 'webhook',
      added: job.added.length,
      modified: job.modified.length,
      removed: job.removed.length,
    })
    try {
      const result = await processChanges(job)
      finishSyncLog(logId, {
        status: result.failed > 0 ? 'partial' : 'success',
        processed: result.processed,
        failed: result.failed,
        removed: result.removed,
        message: result.failed > 0 ? `${result.failed} 个文件失败` : null as unknown as string,
        detail: { errors: result.errors },
      })
    } catch (err) {
      const msg = (err as Error).message
      console.error('[webhook] job failed:', msg)
      finishSyncLog(logId, { status: 'failed', message: msg })
    }
  }
  processing = false
}

export default defineEventHandler(async event => {
  const raw = await readRawBody(event, false)
  if (!raw) apiError(400, 'empty body')

  const secret = useRuntimeConfig().githubWebhookSecret
  if (secret) {
    const sig = getHeader(event, 'x-hub-signature-256')
    if (!sig) apiError(401, 'Missing signature')
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw as Buffer).digest('hex')
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        apiError(401, 'Invalid signature')
      }
    } catch {
      apiError(401, 'Invalid signature')
    }
  }

  const ev = getHeader(event, 'x-github-event')
  if (ev !== 'push') return { ok: true }

  let payload: { commits?: Array<{ added?: string[]; modified?: string[]; removed?: string[] }> }
  try {
    payload = JSON.parse((raw as Buffer).toString('utf-8'))
  } catch {
    return { ok: true }
  }

  const added: string[] = []
  const modified: string[] = []
  const removed: string[] = []
  for (const commit of payload.commits || []) {
    added.push(...(commit.added || []))
    modified.push(...(commit.modified || []))
    removed.push(...(commit.removed || []))
  }

  if (added.length + modified.length + removed.length === 0) return { ok: true }

  console.log(`[webhook] push: +${added.length} ~${modified.length} -${removed.length}`)
  queue.push({ added, modified, removed })
  
  // GitHub PR merge 后 API 有短暂不一致，延迟 5 分钟再处理
  setTimeout(() => drainQueue(), 5 * 60 * 1000)

  return { ok: true }
})
