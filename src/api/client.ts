/**
 * Abhigyan Frontend API Client
 * Configurable HTTP client with automatic JWT token attachment and error extraction.
 */

export const AUTH_TOKEN_KEY = 'abhigyan_token'
export const AUTH_USER_KEY = 'abhigyan_current_user'
export const UNAUTHORIZED_EVENT = 'abhigyan:unauthorized'

const rawApiUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)
    : undefined

export const API_BASE_URL = rawApiUrl
  ? String(rawApiUrl).replace(/\/$/, '')
  : 'https://abhigyann.onrender.com/api'

export class ApiError extends Error {
  public status: number
  public data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Retrieve the currently persisted JWT access token.
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * Persist the active JWT access token to localStorage.
 */
export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // Storage access unavailable
  }
}

/**
 * Remove the persisted JWT access token from localStorage.
 */
export function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // Storage access unavailable
  }
}

/**
 * Subscribe to 401 Unauthorized events (e.g. expired or invalid tokens).
 */
export function onUnauthorized(callback: () => void): () => void {
  const handler = () => callback()
  window.addEventListener(UNAUTHORIZED_EVENT, handler)
  return () => {
    window.removeEventListener(UNAUTHORIZED_EVENT, handler)
  }
}

/**
 * Format error message from FastAPI standard response payload.
 */
function extractErrorMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const errorObj = data as Record<string, unknown>
    if (typeof errorObj.detail === 'string') {
      return errorObj.detail
    }
    if (Array.isArray(errorObj.detail)) {
      const messages = errorObj.detail
        .map((item: unknown) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            const entry = item as { loc?: (string | number)[]; msg: string }
            const field = entry.loc ? entry.loc.slice(1).join('.') : ''
            return field ? `${field}: ${entry.msg}` : entry.msg
          }
          return String(item)
        })
        .filter(Boolean)
      if (messages.length > 0) {
        return messages.join(', ')
      }
    }
    if (typeof errorObj.message === 'string') {
      return errorObj.message
    }
  }

  switch (status) {
    case 400:
      return 'Bad request. Please verify submitted parameters.'
    case 401:
      return 'Invalid credentials or expired session.'
    case 403:
      return 'Access forbidden. Insufficient permissions for this action.'
    case 404:
      return 'Requested resource not found.'
    case 500:
      return 'Internal server error. Please try again later.'
    default:
      return `Request failed with HTTP status ${status}.`
  }
}

/**
 * Core API request method supporting automatic JWT attachment and error parsing.
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://')
  const url = isAbsolute
    ? endpoint
    : `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`

  const headers = new Headers(options.headers || {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const token = getAuthToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const isJsonBody =
    options.body &&
    typeof options.body === 'string' &&
    !headers.has('Content-Type')

  if (isJsonBody) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
    })
  } catch (error) {
    const networkMessage =
      error instanceof Error ? error.message : 'Network connection failed'
    throw new ApiError(
      `Unable to reach backend API (${API_BASE_URL}): ${networkMessage}`,
      0,
      error
    )
  }

  if (response.status === 401) {
    clearAuthToken()
    try {
      localStorage.removeItem(AUTH_USER_KEY)
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  let data: unknown
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    const message = extractErrorMessage(response.status, data)
    throw new ApiError(message, response.status, data)
  }

  return data as T
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
}
