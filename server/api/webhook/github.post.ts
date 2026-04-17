import crypto from 'node:crypto'
import { processChanges } from '~/server/utils/contentPipeline'
import { apiError } from '~/server/utils/auth'

let processing = false
const queue: Array<{ added: string[]; modified: string[]; removed: string[] }> = []

async function drainQueue() {
  if (processing || queue.length === 0) return
  processing = true
  while (queue.length > 0) {
    const job = queue.shift()!
    try { await processChanges(job) }
    catch (err) { console.error('[webhook] job failed:', (err as Error).message) }
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
  drainQueue()

  return { ok: true }
})
