import { API_BASE_URL } from './config.js'

const TOKEN_KEY = 'rr_token'
const USER_KEY = 'rr_user'

function store() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const getToken = () => store()?.getItem(TOKEN_KEY) || null
export function getSavedUser() {
  try {
    return JSON.parse(store()?.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}
export function saveSession(token, user) {
  const s = store()
  if (!s) return
  if (token) s.setItem(TOKEN_KEY, token)
  if (user) s.setItem(USER_KEY, JSON.stringify(user))
}
export function clearSession() {
  store()?.removeItem(TOKEN_KEY)
  store()?.removeItem(USER_KEY)
}

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

function buildUrl(path, query) {
  let url = API_BASE_URL + path
  if (query) {
    const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== false))
    const s = params.toString()
    if (s) url += (url.includes('?') ? '&' : '?') + s
  }
  return url
}

/**
 * Call the PHP API. Every response is { success, message, data, errors? }.
 *   await api('/reports/mine.php')
 *   await api('/auth/login.php', { method: 'POST', body: { email, password } })
 *   await api('/reports/create.php', { method: 'POST', body: formData })   // FormData for photos
 * Returns `data` (and the message as .message on objects); throws ApiError with .errors per field.
 */
export async function api(path, { method = 'GET', body, query } = {}) {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (body instanceof FormData) {
    payload = body // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload })
  } catch {
    throw new ApiError(`Cannot reach the server at ${API_BASE_URL}. Is Apache running (XAMPP), or is the site online?`, 0)
  }

  let json
  try {
    json = await res.json()
  } catch {
    throw new ApiError(`The server sent something that is not JSON (HTTP ${res.status}). Open ${API_BASE_URL}/health.php to check the setup.`, res.status)
  }

  if (res.status === 401 && token) {
    clearSession()
    window.dispatchEvent(new Event('auth:expired'))
  }
  if (!json.success) throw new ApiError(json.message || 'Request failed', res.status, json.errors || {})
  api.lastMessage = json.message
  return json.data
}

/** Link for downloads and <img> tags (they cannot send headers, so the token goes in the URL). */
export function fileUrl(path, query = {}) {
  return buildUrl(path, { ...query, token: getToken() })
}
