const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

export const api = {
  getItems: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/items${q ? '?' + q : ''}`);
  },
  getItem: (slug, headers = {}) => request(`/items/${slug}`, { headers }),
  getCategories: () => request('/items/categories'),
  updateStatus: (slug, status, headers) =>
    request(`/items/${slug}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    }),
  deleteItem: (slug, headers) =>
    request(`/items/${slug}`, { method: 'DELETE', headers }),
  login: (password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
