import { db } from './db'
import type {
  AnthropicAuthMode,
  AnthropicGatewayEffectiveSettings,
  AnthropicGatewayResolvedConfig,
  AnthropicGatewaySettings,
  AnthropicGatewayUpdateRequest,
} from '../../types/settings'

const HARDCODED_ANTHROPIC_BASE_URL = 'https://www.fusecode.cc'
const HARDCODED_ANTHROPIC_TOKEN = 'sk-f7cc027928ef0a2bd0b8d24bf882d138390f55220a1cd5a43e8d9d7d862a1eb7'
const HARDCODED_ANTHROPIC_AUTH_MODE: AnthropicAuthMode = 'bearer'

const SETTING_KEYS = {
  enabled: 'anthropic.route.enabled',
  label: 'anthropic.route.label',
  baseUrl: 'anthropic.route.base_url',
  defaultModel: 'anthropic.route.default_model',
  authMode: 'anthropic.route.auth_mode',
  version: 'anthropic.route.version',
  apiKey: 'anthropic.route.api_key',
} as const

interface SettingRow {
  value: string
  updated_at: string
}

interface StoredAnthropicGatewaySnapshot {
  enabled: boolean
  label: string
  base_url: string
  default_model: string
  auth_mode: string
  anthropic_version: string
  api_key: string
  updated_at: string | null
}

function getSettingRow(key: string): SettingRow | null {
  const row = db.prepare('SELECT value, updated_at FROM app_settings WHERE key = ? LIMIT 1').get(key) as SettingRow | undefined
  return row || null
}

function getSettingValue(key: string): string {
  return getSettingRow(key)?.value || ''
}

function setSettingValue(key: string, value: string): void {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, new Date().toISOString())
}

function deleteSettingValue(key: string): void {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
}

function maskApiKey(apiKey: string): string | null {
  const clean = apiKey.trim()
  if (!clean) return null
  if (clean.length <= 8) return `${clean.slice(0, 2)}****`
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`
}

function normalizeAuthMode(value: string): AnthropicAuthMode {
  return value === 'bearer' ? 'bearer' : 'x_api_key'
}

export function isAnthropicDefaultModelPlaceholder(model: string): boolean {
  const clean = model.trim().toLowerCase()
  return !clean || clean === 'anthropic-default' || clean === 'anthropic-config-default'
}

function getFallbackAnthropicGatewayConfig(): AnthropicGatewayResolvedConfig {
  return {
    enabled: false,
    label: 'Anthropic Route',
    base_url: process.env.ANTHROPIC_BASE_URL?.trim() || HARDCODED_ANTHROPIC_BASE_URL,
    default_model: process.env.SKILL_ANTHROPIC_DEFAULT_MODEL?.trim() || 'claude-sonnet-4-20250514',
    auth_mode: normalizeAuthMode(process.env.ANTHROPIC_AUTH_MODE || HARDCODED_ANTHROPIC_AUTH_MODE),
    anthropic_version: process.env.ANTHROPIC_VERSION?.trim() || '2023-06-01',
    api_key: process.env.ANTHROPIC_API_KEY?.trim()
      || process.env.ANTHROPIC_AUTH_TOKEN?.trim()
      || HARDCODED_ANTHROPIC_TOKEN,
  }
}

function getStoredAnthropicGatewaySnapshot(): StoredAnthropicGatewaySnapshot {
  const updatedAt = getSettingRow(SETTING_KEYS.baseUrl)?.updated_at
    || getSettingRow(SETTING_KEYS.apiKey)?.updated_at
    || null

  return {
    enabled: getSettingValue(SETTING_KEYS.enabled) === '1',
    label: getSettingValue(SETTING_KEYS.label).trim(),
    base_url: getSettingValue(SETTING_KEYS.baseUrl).trim(),
    default_model: getSettingValue(SETTING_KEYS.defaultModel).trim(),
    auth_mode: getSettingValue(SETTING_KEYS.authMode).trim(),
    anthropic_version: getSettingValue(SETTING_KEYS.version).trim(),
    api_key: getSettingValue(SETTING_KEYS.apiKey).trim(),
    updated_at: updatedAt,
  }
}

export function getAnthropicGatewaySettings(): AnthropicGatewaySettings {
  const fallback = getFallbackAnthropicGatewayConfig()
  const stored = getStoredAnthropicGatewaySnapshot()

  return {
    enabled: stored.enabled,
    label: stored.label || fallback.label,
    base_url: stored.base_url || fallback.base_url,
    default_model: stored.default_model || fallback.default_model,
    auth_mode: stored.auth_mode ? normalizeAuthMode(stored.auth_mode) : fallback.auth_mode,
    anthropic_version: stored.anthropic_version || fallback.anthropic_version,
    api_key_configured: !!stored.api_key,
    api_key_preview: maskApiKey(stored.api_key),
    updated_at: stored.updated_at,
  }
}

export function getEffectiveAnthropicGatewaySettings(): AnthropicGatewayEffectiveSettings {
  const resolved = getResolvedAnthropicGatewayConfig()
  const stored = getStoredAnthropicGatewaySnapshot()

  // 判断实际来源：如果 enabled 且所有关键字段都来自 DB，才算 database
  const isFullyFromDatabase = resolved.enabled
    && stored.base_url
    && stored.default_model
    && stored.api_key

  return {
    enabled: resolved.enabled,
    source: isFullyFromDatabase ? 'database' : 'fallback',
    label: resolved.label,
    base_url: resolved.base_url,
    default_model: resolved.default_model,
    auth_mode: resolved.auth_mode,
    anthropic_version: resolved.anthropic_version,
    api_key_configured: !!resolved.api_key,
    api_key_preview: maskApiKey(resolved.api_key),
  }
}

export function getResolvedAnthropicGatewayConfig(): AnthropicGatewayResolvedConfig {
  const fallback = getFallbackAnthropicGatewayConfig()
  const stored = getStoredAnthropicGatewaySnapshot()

  if (!stored.enabled) {
    return {
      ...fallback,
      enabled: false,
    }
  }

  return {
    enabled: true,
    label: stored.label || fallback.label,
    base_url: stored.base_url || fallback.base_url,
    default_model: stored.default_model || fallback.default_model,
    auth_mode: stored.auth_mode ? normalizeAuthMode(stored.auth_mode) : fallback.auth_mode,
    anthropic_version: stored.anthropic_version || fallback.anthropic_version,
    api_key: stored.api_key || fallback.api_key,
  }
}

export function saveAnthropicGatewaySettings(input: AnthropicGatewayUpdateRequest): AnthropicGatewaySettings {
  const normalizedBaseUrl = input.base_url.trim()
  const normalizedModel = input.default_model.trim()
  const normalizedVersion = input.anthropic_version.trim() || '2023-06-01'
  const normalizedLabel = input.label?.trim() || 'Anthropic Route'
  const normalizedAuthMode = normalizeAuthMode(input.auth_mode)

  if (!normalizedBaseUrl) throw new Error('Base URL 不能为空')
  if (!normalizedModel) throw new Error('默认模型不能为空')

  setSettingValue(SETTING_KEYS.enabled, input.enabled ? '1' : '0')
  setSettingValue(SETTING_KEYS.label, normalizedLabel)
  setSettingValue(SETTING_KEYS.baseUrl, normalizedBaseUrl)
  setSettingValue(SETTING_KEYS.defaultModel, normalizedModel)
  setSettingValue(SETTING_KEYS.authMode, normalizedAuthMode)
  setSettingValue(SETTING_KEYS.version, normalizedVersion)

  if (input.clear_api_key) {
    deleteSettingValue(SETTING_KEYS.apiKey)
  } else if (typeof input.api_key === 'string' && input.api_key.trim()) {
    setSettingValue(SETTING_KEYS.apiKey, input.api_key.trim())
  }

  return getAnthropicGatewaySettings()
}
