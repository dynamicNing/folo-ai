export type SkillCategory = 'prompt' | 'agent' | 'workflow' | 'external'
export type SkillStatus = 'active' | 'disabled'
export type Provider = 'openai' | 'anthropic' | 'external'
export type EngineType = 'llm_direct' | 'agent_sdk' | 'external'
export type RunStatus = 'queued' | 'running' | 'waiting_approval' | 'succeeded' | 'failed' | 'cancelled'
export type SkillSourceType = 'inline' | 'skill_folder' | 'external_path'
export type SkillOrigin = 'builtin' | 'external'

export interface SkillToolPolicy {
  network: boolean
  filesystem_read: boolean
  filesystem_write: boolean
  shell: boolean
  browser: boolean
  approval_required: boolean
}

export interface SkillExample {
  title: string
  prompt?: string
  note?: string
  input?: Record<string, unknown>
}

export interface SkillSourceMetadata extends Record<string, unknown> {
  frontmatter?: Record<string, unknown>
  declared_provider?: Provider | string | null
  declared_engine_type?: EngineType | string | null
  declared_default_model?: string | null
  skill_md_path?: string
  imported_from?: string
  content_excerpt?: string
  tags?: string[]
  trigger_keywords?: string[]
  limitations?: string[]
  examples?: SkillExample[]
}

export interface SkillDefinitionSummary {
  slug: string
  name: string
  description: string
  category: SkillCategory
  engine_type: EngineType
  default_provider: Provider
  default_model: string
  source_origin: SkillOrigin
  source_label: string | null
  source_version: string | null
  status: SkillStatus
  created_at: string
  updated_at: string
}

export interface SkillDefinitionDetail extends SkillDefinitionSummary {
  source_type: SkillSourceType
  source_path: string | null
  source_metadata: SkillSourceMetadata
  input_schema: Record<string, unknown>
  output_schema: Record<string, unknown>
  tool_policy: SkillToolPolicy
}

export interface SkillListParams {
  category?: SkillCategory | ''
  status?: SkillStatus | ''
  provider?: Provider | ''
  source_origin?: SkillOrigin | ''
}

export interface SkillCatalogSyncResponse {
  roots: string[]
  scanned: number
  created: number
  updated: number
  skipped: number
  errors: Array<{
    path: string
    message: string
  }>
}

export interface SkillRunSummary {
  run_uid: string
  skill_slug: string
  skill_name: string | null
  provider: Provider
  engine_type: EngineType
  model: string
  status: RunStatus
  error_message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
}

export interface SkillRunDetail extends SkillRunSummary {
  input: Record<string, unknown>
  output: Record<string, unknown>
  token_usage: Record<string, unknown>
  cost: Record<string, unknown>
}

export interface SkillRunEvent {
  id: number
  run_uid: string
  seq: number
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface ApprovalRequest {
  id: number
  run_uid: string
  request_type: string
  scope: string
  human_message: string
  payload: Record<string, unknown>
  status: ApprovalStatus
  created_at: string
  decided_at: string | null
}

export interface Artifact {
  id: number
  run_uid: string
  kind: string
  title: string
  file_path: string | null
  content_text: string | null
  mime_type: string | null
  meta: Record<string, unknown>
  created_at: string
}

export interface SkillRunListParams {
  page?: number
  pageSize?: number
  skill_slug?: string
  status?: RunStatus | ''
  provider?: Provider | ''
}

export interface SkillRunListResponse {
  data: SkillRunSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SkillRunCreateRequest {
  skill_slug: string
  input: Record<string, unknown>
  provider?: Provider
  model?: string
}
