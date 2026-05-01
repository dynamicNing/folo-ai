import type {
  Article,
  AuthMeResponse,
  CollectResult,
  CustomFeed,
  ItemListParams,
  ItemListResponse,
  LoginResponse,
  SocialItemListResponse,
  SocialStatus,
  SyncLog,
  SyncRunResult,
} from '~/types/article'
import type { LearningChapterDetail, LearningDepth, LearningGenerateResponse, LearningSourceType, LearningTopic, LearningTopicDetail } from '~/types/learning'
import type { SkillChatSessionCreateRequest, SkillChatSessionRecord, SkillChatSessionUpdateRequest } from '~/types/skillChat'
import type {
  AnthropicGatewayDebugRequest,
  AnthropicGatewayDebugResponse,
  ModelSettingsResponse,
  AnthropicGatewayUpdateRequest,
} from '~/types/settings'
import type {
  ApprovalRequest,
  Artifact,
  SkillCatalogSyncResponse,
  SkillDefinitionDetail,
  SkillDefinitionSummary,
  SkillListParams,
  SkillRunCreateRequest,
  SkillRunDetail,
  SkillRunEvent,
  SkillRunListParams,
  SkillRunListResponse,
} from '~/types/skill'

type Headers = Record<string, string>

function toQuery(params: Record<string, unknown>): string {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    clean[k] = String(v)
  }
  const q = new URLSearchParams(clean).toString()
  return q ? `?${q}` : ''
}

export function useApi() {
  const BASE = '/api'

  async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers as Headers) },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as Record<string, unknown>))
      const msg =
        (err as any).data?.error ||
        (err as any).error ||
        (err as any).statusMessage ||
        (err as any).message ||
        res.statusText
      throw new Error(msg || '请求失败')
    }
    return res.json() as Promise<T>
  }

  return {
    getItems: (params: ItemListParams = {}) =>
      request<ItemListResponse>(`/items${toQuery(params as Record<string, unknown>)}`),
    getItem: (slug: string, headers: Headers = {}) =>
      request<Article>(`/items/${slug}`, { headers }),
    getCategories: () => request<string[]>('/items/categories'),
    updateStatus: (slug: string, status: string, headers: Headers) =>
      request<{ ok: true }>(`/items/${slug}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      }),
    deleteItem: (slug: string, headers: Headers) =>
      request<{ ok: true }>(`/items/${slug}`, { method: 'DELETE', headers }),
    login: (password: string) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    logout: () =>
      request<{ ok: true }>('/auth/logout', {
        method: 'POST',
      }),
    getMe: () =>
      request<AuthMeResponse>('/auth/me'),

    // Learning
    getLearningTopics: () =>
      request<{ topics: LearningTopic[] }>('/learn/topics'),
    getLearningTopic: (slug: string) =>
      request<LearningTopicDetail>(`/learn/topics/${slug}`),
    getLearningChapter: (topicSlug: string, chapterSlug: string) =>
      request<LearningChapterDetail>(`/learn/topics/${topicSlug}/chapters/${chapterSlug}`),
    generateLearningTopic: (
      payload: { topic: string; source_type: LearningSourceType; context?: string; depth: LearningDepth },
      headers: Headers = {}
    ) =>
      request<LearningGenerateResponse>('/learn/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),

    // Skills
    getSkills: (params: SkillListParams = {}) =>
      request<{ data: SkillDefinitionSummary[] }>(`/skills${toQuery(params as Record<string, unknown>)}`),
    getSkill: (slug: string, headers: Headers = {}) =>
      request<SkillDefinitionDetail>(`/skills/${slug}`, { headers }),
    syncSkills: (headers: Headers = {}) =>
      request<SkillCatalogSyncResponse>('/skills/sync', {
        method: 'POST',
        headers,
      }),
    getSkillRuns: (params: SkillRunListParams = {}, headers: Headers = {}) =>
      request<SkillRunListResponse>(`/skill-runs${toQuery(params as Record<string, unknown>)}`, { headers }),
    getSkillRun: (runUid: string, headers: Headers = {}) =>
      request<SkillRunDetail>(`/skill-runs/${runUid}`, { headers }),
    getSkillRunEvents: (runUid: string, headers: Headers = {}, since = 0, limit = 200) =>
      request<{ data: SkillRunEvent[] }>(`/skill-runs/${runUid}/events${toQuery({ since, limit })}`, { headers }),
    getSkillRunApprovals: (runUid: string, headers: Headers = {}) =>
      request<{ data: ApprovalRequest[] }>(`/skill-runs/${runUid}/approvals`, { headers }),
    getSkillRunArtifacts: (runUid: string, headers: Headers = {}) =>
      request<{ data: Artifact[] }>(`/skill-runs/${runUid}/artifacts`, { headers }),
    createSkillRun: (payload: SkillRunCreateRequest, headers: Headers = {}) =>
      request<SkillRunDetail>('/skill-runs', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),
    approveSkillRunApproval: (runUid: string, approvalId: number, headers: Headers = {}) =>
      request<{ run: SkillRunDetail; approval: ApprovalRequest }>(`/skill-runs/${runUid}/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers,
      }),
    rejectSkillRunApproval: (runUid: string, approvalId: number, headers: Headers = {}) =>
      request<{ run: SkillRunDetail; approval: ApprovalRequest }>(`/skill-runs/${runUid}/approvals/${approvalId}/reject`, {
        method: 'POST',
        headers,
      }),
    getSkillChatSessions: (headers: Headers = {}) =>
      request<{ data: SkillChatSessionRecord[] }>('/skill-chat/sessions', { headers }),
    createSkillChatSession: (payload: SkillChatSessionCreateRequest = {}, headers: Headers = {}) =>
      request<SkillChatSessionRecord>('/skill-chat/sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),
    updateSkillChatSession: (sessionId: string, payload: SkillChatSessionUpdateRequest, headers: Headers = {}) =>
      request<SkillChatSessionRecord>(`/skill-chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      }),
    deleteSkillChatSession: (sessionId: string, headers: Headers = {}) =>
      request<{ ok: true }>(`/skill-chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers,
      }),

    // Settings
    getModelSettings: (headers: Headers = {}) =>
      request<ModelSettingsResponse>('/settings/models', { headers }),
    updateAnthropicSettings: (payload: AnthropicGatewayUpdateRequest, headers: Headers = {}) =>
      request<ModelSettingsResponse>('/settings/models/anthropic', {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      }),
    debugAnthropicGateway: (payload: AnthropicGatewayDebugRequest, headers: Headers = {}) =>
      request<AnthropicGatewayDebugResponse>('/settings/models/anthropic-debug', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }),

    // Social
    getSocialStatus: () => request<SocialStatus>('/social/status'),
    getSocialItems: (params: Record<string, unknown> = {}) =>
      request<SocialItemListResponse>(`/social/items${toQuery(params)}`),
    triggerCollect: (platform: string, headers: Headers) =>
      request<CollectResult>('/social/collect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ platform }),
      }),
    getCustomFeeds: () => request<CustomFeed[]>('/social/feeds'),
    addCustomFeed: (name: string, url: string, headers: Headers) =>
      request<CustomFeed>('/social/feeds', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, url }),
      }),
    removeCustomFeed: (id: string, headers: Headers) =>
      request<{ ok: true }>(`/social/feeds/${id}`, { method: 'DELETE', headers }),
    toggleCustomFeed: (id: string, headers: Headers) =>
      request<CustomFeed>(`/social/feeds/${id}/toggle`, { method: 'PATCH', headers }),
    collectCustomFeeds: (headers: Headers) =>
      request<CollectResult>('/social/collect/custom', { method: 'POST', headers }),

    // Sync
    runSyncAll: (headers: Headers) =>
      request<SyncRunResult>('/webhook/sync-all', { method: 'POST', headers, body: JSON.stringify({ source: 'manual' }) }),
    getSyncLogs: (headers: Headers, limit = 50) =>
      request<{ data: SyncLog[] }>(`/sync/logs?limit=${limit}`, { headers }),
  }
}
