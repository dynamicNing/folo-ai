import { requireAuth } from '~/server/utils/auth'
import { getAnthropicGatewaySettings, getEffectiveAnthropicGatewaySettings } from '~/server/utils/appSettings'
import type { ModelSettingsResponse } from '~/types/settings'

export default defineEventHandler((event): ModelSettingsResponse => {
  requireAuth(event)
  return {
    anthropic: getAnthropicGatewaySettings(),
    anthropic_effective: getEffectiveAnthropicGatewaySettings(),
  }
})
