// Fetch wrapper: bearer access token in memory (+sessionStorage), refresh via httpOnly cookie on 401.
const BASE = '/api/v1'
let accessToken: string | null = sessionStorage.getItem('sm_access')
let refreshing: Promise<boolean> | null = null
const listeners = new Set<(loggedIn: boolean) => void>()

export function onAuthChange(fn: (loggedIn: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setToken(t: string | null) {
  accessToken = t
  if (t) sessionStorage.setItem('sm_access', t)
  else sessionStorage.removeItem('sm_access')
  listeners.forEach((l) => l(!!t))
}

export function getToken() {
  return accessToken
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function refresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) return false
        const d = await r.json()
        setToken(d.access_token)
        return true
      })
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0)
      })
  }
  return refreshing
}

type Params = Record<string, string | number | boolean | undefined | null>

export function qs(params?: Params): string {
  if (!params) return ''
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  })
  const s = p.toString()
  return s ? `?${s}` : ''
}

export async function api<T = any>(path: string, opts: RequestInit & { params?: Params; raw?: boolean } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (opts.body && typeof opts.body === 'string') headers['Content-Type'] = 'application/json'
  const r = await fetch(`${BASE}${path}${qs(opts.params)}`, { ...opts, headers, credentials: 'include' })
  if (r.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refresh()) return api<T>(path, opts, false)
    setToken(null)
  }
  if (!r.ok) {
    let msg = r.statusText
    try {
      const d = await r.json()
      msg = typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)
    } catch {
      /* ignore */
    }
    throw new ApiError(r.status, msg)
  }
  if (opts.raw) return (await r.blob()) as unknown as T
  return r.status === 204 ? (undefined as T) : r.json()
}

export const post = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) })
export const patch = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const put = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) })

export async function download(path: string, filename: string, params?: Params) {
  const blob = await api<Blob>(path, { params, raw: true })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function login(email: string, password: string) {
  const d = await api<{ access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false)
  setToken(d.access_token)
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
  setToken(null)
}

export async function tryRestore(): Promise<boolean> {
  if (accessToken) return true
  return refresh()
}
