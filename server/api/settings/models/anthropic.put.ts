import { apiError, requireAuth } from '~/server/utils/auth'
import { getEffectiveAnthropicGatewaySettings, saveAnthropicGatewaySettings } from '~/server/utils/appSettings'
import type { AnthropicGatewayUpdateRequest, ModelSettingsResponse } from '~/types/settings'

export default defineEventHandler(async (event): Promise<ModelSettingsResponse> => {
  requireAuth(event)
  const body = await readBody(event).catch(() => ({})) as Partial<AnthropicGatewayUpdateRequest>

  try {
    const anthropic = saveAnthropicGatewaySettings({
      enabled: !!body.enabled,
      label: body.label,
      base_url: body.base_url?.trim() || '',
      default_model: body.default_model?.trim() || '',
      auth_mode: body.auth_mode === 'bearer' ? 'bearer' : 'x_api_key',
      anthropic_version: body.anthropic_version?.trim() || '2023-06-01',
      api_key: typeof body.api_key === 'string' ? body.api_key : undefined,
      clear_api_key: !!body.clear_api_key,
    })

    return {
      anthropic,
      anthropic_effective: getEffectiveAnthropicGatewaySettings(),
    }
  } catch (err) {
    apiError(400, (err as Error).message)
  }
})
