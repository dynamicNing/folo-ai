import { execFile } from 'node:child_process'
import { apiError } from '~/server/utils/auth'
import { getResolvedAnthropicGatewayConfig } from '~/server/utils/appSettings'
import { resolveAnthropicEndpoint, resolveAnthropicModel } from '~/server/utils/providers/anthropic'
import { runDirectSkill, runAgentSkill } from '~/server/utils/skillRunner'
import { getSkillChatSession, updateSkillChatSession } from '~/server/utils/skillChatStore'
import { getSkillChatRunnableSkill, listSkillChatRunnableSkillDetails } from '~/server/utils/skillChatSkills'

function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
}

function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'claude',
      ['-p', prompt, '--dangerously-skip-permissions', '--output-format', 'json'],
      { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(err)
        const raw = stripAnsi(stdout).trim()
        try {
          const parsed = JSON.parse(raw) as { result?: string; is_error?: boolean }
          if (parsed.is_error) return reject(new Error(parsed.result || '执行出错'))
          resolve(parsed.result?.trim() || '已完成。')
        } catch {
          resolve(raw || stripAnsi(stderr).trim() || '已完成。')
        }
      },
    )
  })
}

export default defineEventHandler(async (event) => {
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
