import type {
  Article,
  CollectResult,
  CustomFeed,
  ItemListParams,
  ItemListResponse,
  LoginResponse,
  SocialItemListResponse,
  SocialStatus,
} from '~/types/article'

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
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || '请求失败')
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
      request<{ ok: true }>(`/items/${slug}/status`, {
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
  }
}
