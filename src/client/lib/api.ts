import { toast } from 'sonner'

const BASE_URL = '/api'

// ─── Custom error class ───────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

// ─── Universal error message extractor ──────────────────────────────────────

/**
 * Extract a displayable string from any caught value.
 * Always use this in catch blocks instead of `String(err)`.
 *
 * Recognized shapes:
 *  - `Error` instances → `.message`
 *  - KinBot API shape `{ error: { code, message } }` → inner message
 *  - Better Auth shape `{ code, message }` (flat) → `.message`. Routes
 *    under `/api/auth/*` are served directly by Better Auth and don't
 *    follow KinBot's wrapped error format.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err !== null && typeof err === 'object') {
    const o = err as { error?: unknown; message?: unknown }
    if (typeof o.error === 'object' && o.error !== null) {
      const inner = o.error as { message?: unknown }
      if (typeof inner.message === 'string' && inner.message) return inner.message
    }
    if (typeof o.message === 'string' && o.message) return o.message
  }
  return 'An unexpected error occurred'
}

/**
 * Shorthand for `toast.error(getErrorMessage(err))`.
 * Use in catch blocks to show a toast with the extracted error message.
 */
export function toastError(err: unknown): void {
  toast.error(getErrorMessage(err))
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    let code = 'REQUEST_FAILED'
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { error?: { code?: string; message?: string } }
      if (body?.error?.message) message = body.error.message
      if (body?.error?.code) code = body.error.code
    } catch {
      // Non-JSON body (HTML 502, 504, Nginx error pages) — keep defaults
    }
    throw new ApiRequestError(message, code, response.status)
  }

  // Guard against empty bodies (204 No Content, DELETE with no body, etc.)
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json') || response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
