import { getResolvedAnthropicGatewayConfig, isAnthropicDefaultModelPlaceholder } from '../appSettings'
import type { AnthropicGatewayResolvedConfig } from '../../../types/settings'

interface AnthropicTextOptions {
  model: string
  prompt: string
  system?: string
  temperature?: number
  maxTokens?: number
}

interface AnthropicResponse {
  content?: Array<{
    type?: string
    text?: string
  }>
  error?: {
    message?: string
  }
}

export function resolveAnthropicEndpoint(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, '')
  if (clean.endsWith('/messages')) return clean
  if (clean.endsWith('/v1')) return `${clean}/messages`
  return `${clean}/v1/messages`
}

export function resolveAnthropicModel(model: string, defaultModel: string): string {
  const requestedModel = model.trim()
  if (isAnthropicDefaultModelPlaceholder(requestedModel)) return defaultModel.trim()
  return requestedModel
}

export async function generateAnthropicTextWithConfig(
  options: AnthropicTextOptions,
  gateway: AnthropicGatewayResolvedConfig
): Promise<string> {
  const apiKey = gateway.api_key.trim()
  if (!apiKey) throw new Error('缺少 ANTHROPIC_API_KEY，无法执行 Anthropic skill')

  const resolvedModel = resolveAnthropicModel(options.model, gateway.default_model)
  if (!resolvedModel) throw new Error('缺少 Anthropic 模型名，无法执行请求')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (gateway.auth_mode === 'bearer') headers.Authorization = `Bearer ${apiKey}`
  else headers['x-api-key'] = apiKey

  if (gateway.anthropic_version) headers['anthropic-version'] = gateway.anthropic_version

  const res = await fetch(resolveAnthropicEndpoint(gateway.base_url || 'https://api.anthropic.com'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      max_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.3,
      system: options.system || undefined,
      messages: [
        { role: 'user', content: options.prompt },
      ],
    }),
  })

  const data = await res.json().catch(() => ({})) as AnthropicResponse
  if (!res.ok) {
    throw new Error(data.error?.message || `Anthropic API error: ${res.status}`)
  }

  const text = (data.content || [])
    .filter(item => item.type === 'text' || (!item.type && item.text))
    .map(item => item.text?.trim() || '')
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!text) throw new Error('Anthropic 未返回可用文本结果')
  return text
}

export async function generateAnthropicText(options: AnthropicTextOptions): Promise<string> {
  return generateAnthropicTextWithConfig(options, getResolvedAnthropicGatewayConfig())
}
