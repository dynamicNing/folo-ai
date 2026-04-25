import { materializeArtifactsForRun } from './artifactStore'
import { runAgentSkill, runDirectSkill } from './skillRunner'
import {
  appendSkillRunEvent,
  finishSkillRunFailure,
  getSkillDefinition,
  listQueuedSkillRunsForRecovery,
  listRunningSkillRunsForRecovery,
  finishSkillRunSuccess,
  startSkillRun,
} from './skillStore'
import type { Provider, SkillDefinitionDetail } from '../../types/skill'

interface QueueInput {
  runUid: string
  skill: SkillDefinitionDetail
  input: Record<string, unknown>
  provider: Provider
  model: string
}

const activeRuns = new Set<string>()
let recoveryFinished = false

export function enqueueSkillRun(job: QueueInput): void {
  if (activeRuns.has(job.runUid)) return
  activeRuns.add(job.runUid)

  setTimeout(async () => {
    try {
      startSkillRun(job.runUid)
      appendSkillRunEvent(job.runUid, 'run.started', {})
      appendSkillRunEvent(job.runUid, 'engine.started', {
        provider: job.provider,
        model: job.model,
        engine_type: job.skill.engine_type,
      })

      const output = job.skill.engine_type === 'agent_sdk'
        ? await runAgentSkill({
            skill: job.skill,
            input: job.input,
            provider: job.provider,
            model: job.model,
            emitEvent: (eventType, payload) => appendSkillRunEvent(job.runUid, eventType, payload || {}),
          })
        : await runDirectSkill({
            skill: job.skill,
            input: job.input,
            provider: job.provider,
            model: job.model,
          })

      appendSkillRunEvent(job.runUid, 'engine.completed', {
        keys: Object.keys(output),
      })
      finishSkillRunSuccess(job.runUid, output)
      materializeArtifactsForRun(job.runUid, output)
      appendSkillRunEvent(job.runUid, 'run.completed', {
        status: 'succeeded',
      })
    } catch (err) {
      const message = (err as Error).message || '未知错误'
      finishSkillRunFailure(job.runUid, message)
      appendSkillRunEvent(job.runUid, 'run.failed', {
        error: message,
      })
    } finally {
      activeRuns.delete(job.runUid)
    }
  }, 0)
}

export function recoverPendingSkillRuns(): void {
  if (recoveryFinished) return
  recoveryFinished = true

  for (const run of listRunningSkillRunsForRecovery()) {
    finishSkillRunFailure(run.run_uid, '服务重启导致运行中断，请重新运行')
    appendSkillRunEvent(run.run_uid, 'run.interrupted', {
      reason: 'server_restart',
    })
  }

  for (const run of listQueuedSkillRunsForRecovery()) {
    const skill = getSkillDefinition(run.skill_slug)
    if (!skill || skill.status !== 'active' || (skill.engine_type !== 'llm_direct' && skill.engine_type !== 'agent_sdk')) {
      finishSkillRunFailure(run.run_uid, '服务重启后无法恢复该任务，请重新发起运行')
      appendSkillRunEvent(run.run_uid, 'queue.recovery_failed', {
        reason: 'skill_unavailable',
      })
      continue
    }

    appendSkillRunEvent(run.run_uid, 'queue.recovered', {
      reason: 'server_restart',
    })
    enqueueSkillRun({
      runUid: run.run_uid,
      skill,
      input: run.input,
      provider: run.provider,
      model: run.model,
    })
  }
}
