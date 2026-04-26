import { db } from '~/server/utils/db'

const GITHUB_OWNER = 'dynamicNing'
const GITHUB_REPO = 'content-archive'
const GITHUB_BRANCH = 'master'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'User-Agent': 'folo-ai' }
  const token = process.env.GITHUB_TOKEN
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

interface SkillRunRow {
  run_uid: string
  skill_slug: string
  input_json: string
  output_json: string
  status: string
  started_at: string
  finished_at: string
  duration_ms: number
  provider: string
  model: string
}

function formatRunAsMarkdown(run: SkillRunRow): string {
  const input = JSON.parse(run.input_json || '{}')
  const output = JSON.parse(run.output_json || '{}')
  const date = run.started_at ? new Date(run.started_at).toISOString().split('T')[0] : 'unknown'

  let md = `---
title: ${run.skill_slug} - ${run.run_uid.slice(0, 8)}
date: ${date}
category: skill-runs
tags: [skill, ${run.skill_slug}]
status: published
---

# Skill Run: ${run.skill_slug}

**Run ID**: \`${run.run_uid}\`
**Status**: ${run.status}
**Provider**: ${run.provider}
**Model**: ${run.model}
**Duration**: ${run.duration_ms}ms
**Started**: ${run.started_at}
**Finished**: ${run.finished_at || 'N/A'}

## Input

\`\`\`json
${JSON.stringify(input, null, 2)}
\`\`\`

## Output

\`\`\`json
${JSON.stringify(output, null, 2)}
\`\`\`
`

  return md
}

async function pushToGitHub(path: string, content: string, message: string): Promise<void> {
  // 1. 获取文件当前 SHA（如果存在）
  const getRes = await fetch(`${GITHUB_API}/contents/${path}`, {
    headers: githubHeaders(),
  })
  let sha: string | undefined
  if (getRes.ok) {
    const data = await getRes.json() as { sha: string }
    sha = data.sha
  }

  // 2. 创建或更新文件
  const body = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  }

  const putRes = await fetch(`${GITHUB_API}/contents/${path}`, {
    method: 'PUT',
    headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    throw new Error(`GitHub push failed: ${putRes.status} ${err}`)
  }
}

export async function exportRunsToGitHub(runIds: string[]): Promise<{ exported: number; errors: string[] }> {
  const errors: string[] = []
  let exported = 0

  for (const runId of runIds) {
    try {
      const run = db.prepare('SELECT * FROM skill_runs WHERE run_uid = ?').get(runId) as SkillRunRow | undefined
      if (!run) {
        errors.push(`${runId}: not found`)
        continue
      }

      const md = formatRunAsMarkdown(run)
      const date = run.started_at ? new Date(run.started_at).toISOString().split('T')[0] : 'unknown'
      const fileName = `${run.skill_slug}-${run.run_uid.slice(0, 8)}.md`
      const yearMonth = date.slice(0, 7) // 2026-04
      const path = `skill-runs/${yearMonth}/${fileName}`

      await pushToGitHub(path, md, `feat: export skill run ${run.run_uid.slice(0, 8)}`)
      exported++
    } catch (e) {
      errors.push(`${runId}: ${(e as Error).message}`)
    }
  }

  return { exported, errors }
}
