export type ArticleStatus = 'published' | 'draft' | 'archived'

export interface Article {
  slug: string
  title: string
  category: string
  tags: string[]
  date: string
  summary: string
  content: string
  status: ArticleStatus
  sha?: string
  updated_at?: string
}

export interface ItemListResponse {
  data: Article[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ItemListParams {
  page?: number
  pageSize?: number
  status?: ArticleStatus | ''
  category?: string
  tag?: string
}

export interface LoginResponse {
  ok: true
}

export interface AuthMeResponse {
  authenticated: boolean
  role?: string
}

export type SyncSource = 'manual' | 'webhook' | 'cli'
export type SyncLogStatus = 'success' | 'failed' | 'partial' | 'running'

export interface SyncLog {
  id: number
  source: SyncSource
  status: SyncLogStatus
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  added: number
  modified: number
  removed: number
  total: number
  processed: number
  failed: number
  message: string | null
  detail: string | null
}

export interface SyncRunResult {
  ok: true
  logId: number
  total: number
  processed: number
  failed: number
  errors: Array<{ path: string; error: string }>
}
