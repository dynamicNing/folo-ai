import { apiError } from '~/server/utils/auth'
import { getResolvedAnthropicGatewayConfig } from '~/server/utils/appSettings'
import { resolveAnthropicEndpoint, resolveAnthropicModel } from '~/server/utils/providers/anthropic'
import { DEFAULT_SKILL_DEFINITIONS } from '~/server/utils/skillRegistry'
import { runDirectSkill, runAgentSkill } from '~/server/utils/skillRunner'
import { getSkillChatSession, updateSkillChatSession } from '~/server/utils/skillChatStore'

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

  const activeSkills = DEFAULT_SKILL_DEFINITIONS.filter(s => s.status === 'active')
  const skills = selectedSkillSlug
    ? activeSkills.filter(s => s.slug === selectedSkillSlug)
    : activeSkills
  if (selectedSkillSlug && !skills.length) apiError(400, '选择的 skill 不存在或不可用')
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

  const newHistory = [
    ...history,
    { role: 'user', content: message },
    { role: 'assistant', content: assistantText },
  ]

  if (sessionId) {
    updateSkillChatSession(sessionId, {
      messages: newHistory,
      messageCount: newHistory.length,
      preview: message.slice(0, 60),
    })
  }

  return { reply: assistantText }
})
