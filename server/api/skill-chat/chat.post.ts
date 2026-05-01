import { spawn } from 'node:child_process'
import { apiError, requireAuth } from '~/server/utils/auth'
import { getResolvedAnthropicGatewayConfig } from '~/server/utils/appSettings'
import { resolveAnthropicEndpoint, resolveAnthropicModel } from '~/server/utils/providers/anthropic'
import { runDirectSkill, runAgentSkill } from '~/server/utils/skillRunner'
import { getSkillChatSession, updateSkillChatSession } from '~/server/utils/skillChatStore'
import { getSkillChatRunnableSkill, listSkillChatRunnableSkillDetails } from '~/server/utils/skillChatSkills'

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
}

function isTruthyEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function isRootOrSudoProcess(): boolean {
  if (typeof process.getuid === 'function' && process.getuid() === 0) return true
  if (typeof process.geteuid === 'function' && process.geteuid() === 0) return true
  return false
}

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function buildClaudeArgs(prompt: string): string[] {
  const args = ['-p', prompt, '--output-format', 'json']
  const skipPermissions = isTruthyEnv(process.env.SKILL_CHAT_CLAUDE_SKIP_PERMISSIONS, true)
  if (skipPermissions && !isRootOrSudoProcess()) {
    args.push('--dangerously-skip-permissions')
  }
  return args
}

function rootPermissionHint(): string {
  if (!isRootOrSudoProcess()) return ''
  return '\n当前服务进程正在以 root/sudo 权限运行。Claude Code 禁止 root/sudo 使用 bypass 权限；需要执行会写文件或运行命令的 Claude Code skill 时，请改用非 root 用户运行 PM2。'
}

function parseClaudeOutput(stdout: string, stderr: string): string {
  const raw = stripAnsi(stdout).trim()
  if (!raw) return stripAnsi(stderr).trim() || '已完成。'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return raw
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw
  const payload = parsed as { result?: unknown; is_error?: unknown }
  const result = typeof payload.result === 'string' ? payload.result.trim() : ''
  if (payload.is_error) throw new Error(result || '执行出错')
  return result || '已完成。'
}

function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = buildClaudeArgs(prompt)
    const timeoutMs = parsePositiveIntEnv(process.env.SKILL_CHAT_CLAUDE_TIMEOUT_MS, 300_000)
    const maxBufferBytes = 10 * 1024 * 1024
    const child = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let timer: NodeJS.Timeout | null = null

    function finish(err: Error | null, result?: string) {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (err) reject(err)
      else resolve(result || '已完成。')
    }

    function appendOutput(current: string, chunk: Buffer, label: string): string {
      const next = current + chunk.toString('utf8')
      if (Buffer.byteLength(next, 'utf8') > maxBufferBytes) {
        child.kill('SIGTERM')
        finish(new Error(`Claude CLI ${label} 输出超过 10MB，已中止`))
        return current
      }
      return next
    }

    timer = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error(`Claude CLI 执行超时（${Math.round(timeoutMs / 1000)} 秒）${rootPermissionHint()}`))
    }, timeoutMs)

    child.stdout?.on('data', chunk => {
      stdout = appendOutput(stdout, chunk, 'stdout')
    })
    child.stderr?.on('data', chunk => {
      stderr = appendOutput(stderr, chunk, 'stderr')
    })
    child.on('error', err => {
      finish(new Error(`Claude CLI 启动失败：${err.message}`))
    })
    child.on('close', (code, signal) => {
      if (settled) return
      if (code !== 0) {
        const detail = stripAnsi(stderr).trim() || stripAnsi(stdout).trim() || `exit=${code}, signal=${signal || 'none'}`
        finish(new Error(`Claude CLI 执行失败：${detail}${rootPermissionHint()}`))
        return
      }
      try {
        finish(null, parseClaudeOutput(stdout, stderr))
      } catch (err) {
        finish(err as Error)
      }
    })
  })
}

export default defineEventHandler(async (event) => {
  requireAuth(event)
  const body = await readBody(event).catch(() => ({})) as {
    session_id?: string
    message?: string
    skill_slug?: string
  }
  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const selectedSkillSlug = typeof body.skill_slug === 'string' ? body.skill_slug.trim() : ''

  if (!message) apiError(400, 'message 不能为空')

  const session = getSkillChatSession(sessionId)
  const history = (session?.messages as any[]) || []

  function saveToSession(reply: string) {
    if (!sessionId) return
    const newHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }]
    updateSkillChatSession(sessionId, {
      messages: newHistory,
      messageCount: newHistory.length,
      preview: message.slice(0, 60),
    })
  }

  // Claude Code skill: spawn `claude -p "/slug message"`
  if (selectedSkillSlug.startsWith('cc:')) {
    const slug = selectedSkillSlug.slice(3)
    if (!/^[a-z0-9-]+$/.test(slug)) apiError(400, '无效的 skill slug')
    const prompt = `/${slug} ${message}`
    const reply = await runClaudeCli(prompt).catch(err => `执行失败：${(err as Error).message}`)
    saveToSession(reply)
    return { reply }
  }

  // Built-in skill: Anthropic tool_use flow
  const selectedSkill = selectedSkillSlug ? getSkillChatRunnableSkill(selectedSkillSlug) : null
  const skills = selectedSkillSlug
    ? (selectedSkill ? [selectedSkill] : [])
    : listSkillChatRunnableSkillDetails()
  if (selectedSkillSlug && !skills.length) apiError(400, '选择的 skill 不存在或不可用')
  if (!skills.length) apiError(400, '当前没有可用 skill')

  const tools = skills.map(skill => ({
    name: skill.slug.replace(/-/g, '_'),
    description: skill.description,
    input_schema: skill.input_schema,
  }))
  const selectedToolName = selectedSkillSlug ? tools[0]?.name : ''

  const messages = [
    ...history.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.text || '',
    })),
    { role: 'user', content: message },
  ]

  const gateway = getResolvedAnthropicGatewayConfig()
  const model = resolveAnthropicModel('anthropic-default', gateway.default_model)
  const endpoint = resolveAnthropicEndpoint(gateway.base_url || 'https://api.anthropic.com')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': gateway.anthropic_version || '2023-06-01',
    ...(gateway.auth_mode === 'bearer'
      ? { Authorization: `Bearer ${gateway.api_key}` }
      : { 'x-api-key': gateway.api_key }),
  }

  const requestBody: Record<string, unknown> = { model, max_tokens: 1024, tools, messages }
  if (selectedToolName) {
    requestBody.tool_choice = { type: 'tool', name: selectedToolName }
  }

  const res1 = await $fetch<any>(endpoint, {
    method: 'POST',
    headers,
    body: requestBody,
  })

  const toolUse = res1.content?.find((b: any) => b.type === 'tool_use')
  let assistantText = ''

  if (toolUse) {
    const skillSlug = toolUse.name.replace(/_/g, '-')
    const skill = skills.find(s => s.slug === skillSlug)

    let skillOutput: Record<string, unknown> = {}
    if (skill) {
      try {
        const runInput = { skill, input: toolUse.input, provider: skill.default_provider, model: skill.default_model }
        skillOutput = skill.engine_type === 'agent_sdk'
          ? await runAgentSkill(runInput)
          : await runDirectSkill(runInput)
      } catch (err) {
        skillOutput = { error: (err as Error).message }
      }
    }

    const res2 = await $fetch<any>(endpoint, {
      method: 'POST',
      headers,
      body: {
        model,
        max_tokens: 2048,
        tools,
        messages: [
          ...messages,
          { role: 'assistant', content: res1.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(skillOutput) }] },
        ],
      },
    })

    assistantText = res2.content?.find((b: any) => b.type === 'text')?.text || '已完成。'
  } else {
    assistantText = res1.content?.find((b: any) => b.type === 'text')?.text || ''
  }

  saveToSession(assistantText)
  return { reply: assistantText }
})
