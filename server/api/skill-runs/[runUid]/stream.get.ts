import { createEventStream } from 'h3'
import { apiError, requireAuth } from '~/server/utils/auth'
import { getSkillRun, getSkillRunStatus, listSkillRunEvents } from '~/server/utils/skillStore'
import type { RunStatus } from '~/types/skill'

function isTerminalStatus(status: RunStatus | null): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled'
}

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const runUid = getRouterParam(event, 'runUid') || ''
  if (!getSkillRun(runUid)) apiError(404, '运行记录不存在')

  const q = getQuery(event)
  let lastSeq = Math.max(0, Number(q.since) || 0)
  const stream = createEventStream(event)
  let cleaned = false

  async function pushBacklog(): Promise<void> {
    const items = listSkillRunEvents(runUid, { since: lastSeq, limit: 200 })
    if (!items.length) return

    lastSeq = items[items.length - 1].seq
    await stream.push(items.map(item => ({
      id: String(item.seq),
      event: 'skill-run-event',
      data: JSON.stringify(item),
    })))
  }

  async function closeStream(status: RunStatus | null): Promise<void> {
    if (cleaned) return
    cleaned = true
    clearInterval(pollTimer)
    clearInterval(heartbeatTimer)
    await stream.push({
      event: 'stream.end',
      data: JSON.stringify({ status }),
    }).catch(() => {})
    await stream.close().catch(() => {})
  }

  const pollTimer = setInterval(async () => {
    await pushBacklog().catch(() => {})
    const status = getSkillRunStatus(runUid)
    if (isTerminalStatus(status)) {
      await closeStream(status)
    }
  }, 800)

  const heartbeatTimer = setInterval(async () => {
    await stream.push({
      event: 'ping',
      data: JSON.stringify({ at: new Date().toISOString() }),
    }).catch(() => {})
  }, 15000)

  stream.onClosed(() => {
    if (cleaned) return
    cleaned = true
    clearInterval(pollTimer)
    clearInterval(heartbeatTimer)
  })

  await pushBacklog()
  setTimeout(async () => {
    const status = getSkillRunStatus(runUid)
    if (isTerminalStatus(status)) {
      await closeStream(status)
    }
  }, 0)

  return stream.send()
})
