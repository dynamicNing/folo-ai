import { requireAuth } from '~/server/utils/auth'
import { getEffectiveAnthropicGatewaySettings, getResolvedAnthropicGatewayConfig } from '~/server/utils/appSettings'
import {
  generateAnthropicTextWithConfig,
  resolveAnthropicEndpoint,
  resolveAnthropicModel,
} from '~/server/utils/providers/anthropic'
import type { AnthropicGatewayDebugRequest, AnthropicGatewayDebugResponse } from '~/types/settings'

function clampTemperature(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function clampMaxTokens(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 128
  return Math.max(16, Math.min(4096, Math.round(value)))
}

export default defineEventHandler(async (event): Promise<AnthropicGatewayDebugResponse> => {
  requireAuth(event)

  const body = await readBody(event).catch(() => ({})) as AnthropicGatewayDebugRequest
  const settings = getEffectiveAnthropicGatewaySettings()
  const gateway = getResolvedAnthropicGatewayConfig()
  const model = resolveAnthropicModel(body.model || '', gateway.default_model)
  const prompt = body.prompt?.trim() || 'Reply with exactly: ANTHROPIC_ROUTE_OK'
  const system = body.system?.trim() || ''
  const temperature = clampTemperature(body.temperature)
  const maxTokens = clampMaxTokens(body.max_tokens)
  const endpoint = resolveAnthropicEndpoint(gateway.base_url || 'https://api.anthropic.com')

  const startedAt = Date.now()

  try {
    const output = await generateAnthropicTextWithConfig({
      model,
      prompt,
      system: system || undefined,
      temperature,
      maxTokens,
    }, gateway)

    return {
      ok: true,
      endpoint,
      auth_mode: gateway.auth_mode,
      anthropic_version: gateway.anthropic_version,
      api_key_preview: settings.api_key_preview,
      model,
      prompt,
      system,
      temperature,
      max_tokens: maxTokens,
      duration_ms: Date.now() - startedAt,
      output,
    }
  } catch (err) {
    return {
      ok: false,
      endpoint,
      auth_mode: gateway.auth_mode,
      anthropic_version: gateway.anthropic_version,
      api_key_preview: settings.api_key_preview,
      model,
      prompt,
      system,
      temperature,
      max_tokens: maxTokens,
      duration_ms: Date.now() - startedAt,
      output: '',
      error: (err as Error).message || '请求失败',
    }
  }
})
