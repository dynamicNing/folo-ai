export type AnthropicAuthMode = 'x_api_key' | 'bearer'

export interface AnthropicGatewaySettings {
  enabled: boolean
  label: string
  base_url: string
  default_model: string
  auth_mode: AnthropicAuthMode
  anthropic_version: string
  api_key_configured: boolean
  api_key_preview: string | null
  updated_at: string | null
}

export interface AnthropicGatewayEffectiveSettings {
  enabled: boolean
  source: 'database' | 'fallback'
  label: string
  base_url: string
  default_model: string
  auth_mode: AnthropicAuthMode
  anthropic_version: string
  api_key_configured: boolean
  api_key_preview: string | null
}

export interface AnthropicGatewayResolvedConfig {
  enabled: boolean
  label: string
  base_url: string
  default_model: string
  auth_mode: AnthropicAuthMode
  anthropic_version: string
  api_key: string
}

export interface AnthropicGatewayUpdateRequest {
  enabled: boolean
  label?: string
  base_url: string
  default_model: string
  auth_mode: AnthropicAuthMode
  anthropic_version: string
  api_key?: string
  clear_api_key?: boolean
}

export interface AnthropicGatewayDebugRequest {
  model?: string
  prompt?: string
  system?: string
  temperature?: number
  max_tokens?: number
}

export interface AnthropicGatewayDebugResponse {
  ok: boolean
  endpoint: string
  auth_mode: AnthropicAuthMode
  anthropic_version: string
  api_key_preview: string | null
  model: string
  prompt: string
  system: string
  temperature: number
  max_tokens: number
  duration_ms: number
  output: string
  error?: string
}

export interface ModelSettingsResponse {
  anthropic: AnthropicGatewaySettings
  anthropic_effective: AnthropicGatewayEffectiveSettings
}
