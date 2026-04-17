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
  token: string
}

export interface SocialItem {
  title: string
  url: string
  source: string
  description?: string
  platform?: string
  _platform?: string
  fetched_at: string
}

export interface SocialStatus {
  rsshubStatus: 'running' | 'stopped' | 'error' | 'unknown'
  lastRun: string | null
  platformLastItems: Record<string, { date?: string; count?: number }>
}

export interface SocialItemListResponse {
  data: SocialItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CollectResult {
  [platform: string]: { saved: number; error?: string }
}

export interface CustomFeed {
  id: string
  name: string
  url: string
  enabled: boolean
  createdAt: string
}
