import { describe, it, expect, beforeEach, afterEach, mock, type Mock } from 'bun:test'
import { ApiRequestError, getErrorMessage, api } from './api'

// ─── getErrorMessage ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('extracts message from ApiRequestError', () => {
    expect(getErrorMessage(new ApiRequestError('not found', 'NOT_FOUND', 404))).toBe('not found')
  })

  it('extracts message from nested error object', () => {
    expect(getErrorMessage({ error: { message: 'inner msg' } })).toBe('inner msg')
  })

  it('ignores nested error object with empty message', () => {
    expect(getErrorMessage({ error: { message: '' } })).toBe('An unexpected error occurred')
  })

  it('ignores nested error object with non-string message', () => {
    expect(getErrorMessage({ error: { message: 42 } })).toBe('An unexpected error occurred')
  })

  it('returns fallback for null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred')
  })

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
  })

  it('returns fallback for plain string', () => {
    expect(getErrorMessage('oops')).toBe('An unexpected error occurred')
  })

  it('returns fallback for number', () => {
    expect(getErrorMessage(500)).toBe('An unexpected error occurred')
  })

  it('returns fallback for object without error key', () => {
    expect(getErrorMessage({ foo: 'bar' })).toBe('An unexpected error occurred')
  })

  it('returns fallback when error key is not an object', () => {
    expect(getErrorMessage({ error: 'string' })).toBe('An unexpected error occurred')
  })

  it('extracts message from Better Auth flat shape', () => {
    // /api/auth/* routes are served by Better Auth and return errors as
    // { message, code } directly, not wrapped in { error: { ... } }.
    expect(
      getErrorMessage({ message: 'Password too short', code: 'PASSWORD_TOO_SHORT' }),
    ).toBe('Password too short')
  })

  it('prefers nested error.message over a top-level message', () => {
    // Defensive: if both shapes are present (KinBot routes shouldn't but
    // could in theory), the wrapped one wins because it's the documented
    // contract.
    expect(
      getErrorMessage({
        error: { message: 'kinbot wins' },
        message: 'flat loses',
      }),
    ).toBe('kinbot wins')
  })
})

// ─── ApiRequestError ──────────────────────────────────────────────────────────

describe('ApiRequestError', () => {
  it('has correct name', () => {
    const err = new ApiRequestError('msg', 'CODE', 400)
    expect(err.name).toBe('ApiRequestError')
  })

  it('inherits from Error', () => {
    const err = new ApiRequestError('msg', 'CODE', 400)
    expect(err instanceof Error).toBe(true)
    expect(err instanceof ApiRequestError).toBe(true)
  })

  it('stores code and status', () => {
    const err = new ApiRequestError('msg', 'NOT_FOUND', 404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.message).toBe('msg')
  })
})

// ─── api wrapper ──────────────────────────────────────────────────────────────

describe('api', () => {
  const originalFetch = globalThis.fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: Mock<any>

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function setupFetchMock(response: {
    ok?: boolean
    status?: number
    json?: () => Promise<unknown>
    headers?: Headers
  }) {
    const headers = response.headers ?? new Headers({ 'content-type': 'application/json' })
    fetchMock = mock(() =>
      Promise.resolve({
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: response.json ?? (() => Promise.resolve({})),
        headers,
      } as Response),
    )
    // @ts-expect-error -- mock doesn't include `preconnect` but that's fine for tests
    globalThis.fetch = fetchMock
  }

  it('api.get sends GET with credentials', async () => {
    setupFetchMock({ json: () => Promise.resolve({ data: 1 }) })

    const result = await api.get('/test')
    expect(result).toEqual({ data: 1 })

    const call = fetchMock.mock.calls[0]!
    expect(call[0]).toBe('/api/test')
    expect((call[1] as RequestInit)?.method).toBeUndefined() // GET is default
    expect((call[1] as RequestInit)?.credentials).toBe('include')
  })

  it('api.post sends POST with JSON body', async () => {
    setupFetchMock({ json: () => Promise.resolve({ ok: true }) })

    await api.post('/items', { name: 'test' })

    const call = fetchMock.mock.calls[0]!
    expect((call[1] as RequestInit)?.method).toBe('POST')
    expect((call[1] as RequestInit)?.body).toBe(JSON.stringify({ name: 'test' }))
  })

  it('api.patch sends PATCH', async () => {
    setupFetchMock({ json: () => Promise.resolve({}) })
    await api.patch('/items/1', { name: 'updated' })

    const call = fetchMock.mock.calls[0]!
    expect((call[1] as RequestInit)?.method).toBe('PATCH')
  })

  it('api.put sends PUT', async () => {
    setupFetchMock({ json: () => Promise.resolve({}) })
    await api.put('/items/1', { name: 'replaced' })

    const call = fetchMock.mock.calls[0]!
    expect((call[1] as RequestInit)?.method).toBe('PUT')
  })

  it('api.delete sends DELETE', async () => {
    setupFetchMock({ json: () => Promise.resolve({}) })
    await api.delete('/items/1')

    const call = fetchMock.mock.calls[0]!
    expect((call[1] as RequestInit)?.method).toBe('DELETE')
  })

  it('throws ApiRequestError on non-ok response with JSON error', async () => {
    setupFetchMock({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: { code: 'VALIDATION', message: 'Invalid input' } }),
    })

    try {
      await api.get('/bad')
      expect(true).toBe(false) // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError)
      const apiErr = err as ApiRequestError
      expect(apiErr.message).toBe('Invalid input')
      expect(apiErr.code).toBe('VALIDATION')
      expect(apiErr.status).toBe(422)
    }
  })

  it('throws ApiRequestError with defaults on non-JSON error response', async () => {
    setupFetchMock({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    })

    try {
      await api.get('/bad')
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(ApiRequestError)
      const apiErr = err as ApiRequestError
      expect(apiErr.message).toBe('Request failed with status 502')
      expect(apiErr.code).toBe('REQUEST_FAILED')
      expect(apiErr.status).toBe(502)
    }
  })

  it('returns undefined for 204 No Content', async () => {
    const headers = new Headers({ 'content-type': 'application/json' })
    setupFetchMock({ ok: true, status: 204, headers })

    const result = await api.delete('/items/1')
    expect(result).toBeUndefined()
  })

  it('returns undefined for non-JSON content type', async () => {
    const headers = new Headers({ 'content-type': 'text/plain' })
    setupFetchMock({ ok: true, status: 200, headers })

    const result = await api.get('/health')
    expect(result).toBeUndefined()
  })

  it('includes Content-Type header', async () => {
    setupFetchMock({ json: () => Promise.resolve({}) })
    await api.get('/test')

    const call = fetchMock.mock.calls[0]!
    expect((call[1] as RequestInit)?.headers).toHaveProperty('Content-Type', 'application/json')
  })
})
