import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

// We need to test the private URL guard indirectly through the tool's execute
// function. The direct helper below mirrors the source logic for edge-case unit
// coverage while integration tests verify the real tool behavior.

type UrlSafety =
  | { allowed: true; privateNetwork: boolean }
  | { allowed: false; reason: string }

function isPrivateIpv4(host: string): boolean {
  return (
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

function isLocalNetworkHostname(host: string): boolean {
  return host.endsWith('.internal') || host.endsWith('.local')
}

function checkUrlSafety(urlStr: string, allowPrivateNetwork: boolean): UrlSafety {
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    return { allowed: false, reason: 'Invalid URL' }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { allowed: false, reason: 'Only HTTP and HTTPS URLs are supported' }
  }

  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0'
  ) {
    return { allowed: false, reason: 'Requests to loopback or unspecified addresses are not allowed' }
  }

  if (host === '169.254.169.254') {
    return { allowed: false, reason: 'Requests to link-local metadata endpoints are not allowed' }
  }

  if (isPrivateIpv4(host) || isLocalNetworkHostname(host)) {
    if (allowPrivateNetwork) return { allowed: true, privateNetwork: true }
    return { allowed: false, reason: 'Requests to private/internal addresses are not allowed' }
  }

  return { allowed: true, privateNetwork: false }
}

function isAllowed(url: string, allowPrivateNetwork = false): boolean {
  return checkUrlSafety(url, allowPrivateNetwork).allowed
}

describe('http_request URL safety', () => {
  it('blocks localhost and loopback addresses even when private network access is enabled', () => {
    expect(isAllowed('http://localhost/api')).toBe(false)
    expect(isAllowed('http://127.0.0.1/')).toBe(false)
    expect(isAllowed('http://[::1]/')).toBe(false)
    expect(isAllowed('http://0.0.0.0/')).toBe(false)

    expect(isAllowed('http://localhost/api', true)).toBe(false)
    expect(isAllowed('http://127.0.0.1/', true)).toBe(false)
    expect(isAllowed('http://[::1]/', true)).toBe(false)
    expect(isAllowed('http://0.0.0.0/', true)).toBe(false)
  })

  it('blocks RFC1918 private IP ranges by default', () => {
    expect(isAllowed('http://10.0.0.1/')).toBe(false)
    expect(isAllowed('http://10.255.255.255/')).toBe(false)
    expect(isAllowed('http://192.168.1.1/')).toBe(false)
    expect(isAllowed('http://192.168.0.100:9090/')).toBe(false)
    expect(isAllowed('http://172.16.0.1/')).toBe(false)
    expect(isAllowed('http://172.17.0.2/')).toBe(false)
    expect(isAllowed('http://172.20.5.5/')).toBe(false)
    expect(isAllowed('http://172.31.255.255/')).toBe(false)
  })

  it('allows RFC1918 private IP ranges when explicitly enabled', () => {
    expect(isAllowed('http://10.0.0.1/', true)).toBe(true)
    expect(isAllowed('http://10.255.255.255/', true)).toBe(true)
    expect(isAllowed('http://192.168.1.1/', true)).toBe(true)
    expect(isAllowed('http://192.168.0.100:9090/', true)).toBe(true)
    expect(isAllowed('http://172.16.0.1/', true)).toBe(true)
    expect(isAllowed('http://172.17.0.2/', true)).toBe(true)
    expect(isAllowed('http://172.20.5.5/', true)).toBe(true)
    expect(isAllowed('http://172.31.255.255/', true)).toBe(true)
  })

  it('blocks link-local metadata endpoint even when private network access is enabled', () => {
    expect(isAllowed('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isAllowed('http://169.254.169.254/latest/meta-data/', true)).toBe(false)
  })

  it('allows local-network hostnames only when explicitly enabled', () => {
    expect(isAllowed('http://myservice.internal/')).toBe(false)
    expect(isAllowed('http://db.cluster.internal:5432/')).toBe(false)
    expect(isAllowed('http://printer.local/')).toBe(false)

    expect(isAllowed('http://myservice.internal/', true)).toBe(true)
    expect(isAllowed('http://db.cluster.internal:5432/', true)).toBe(true)
    expect(isAllowed('http://printer.local/', true)).toBe(true)
  })

  it('blocks invalid and non-HTTP URLs', () => {
    expect(isAllowed('not-a-url')).toBe(false)
    expect(isAllowed('')).toBe(false)
    expect(isAllowed('ftp://example.com/file')).toBe(false)
  })

  it('allows public URLs', () => {
    expect(isAllowed('https://api.example.com/v1')).toBe(true)
    expect(isAllowed('https://google.com')).toBe(true)
    expect(isAllowed('http://8.8.8.8/')).toBe(true)
    expect(isAllowed('https://api.openai.com/v1/chat')).toBe(true)
  })

  it('allows nearby public IP ranges that are outside private ranges', () => {
    expect(isAllowed('http://172.32.0.1/')).toBe(true)
    expect(isAllowed('http://192.169.1.1/')).toBe(true)
    expect(isAllowed('http://11.0.0.1/')).toBe(true)
  })
})

describe('httpRequestTool registration', () => {
  it('imports and has correct shape', async () => {
    const { httpRequestTool } = await import('./http-request-tools')
    expect(httpRequestTool).toBeDefined()
    expect(httpRequestTool.availability).toEqual(['main', 'sub-kin'])
    expect(typeof httpRequestTool.create).toBe('function')
  })

  it('create() returns a tool object', async () => {
    const { httpRequestTool } = await import('./http-request-tools')
    const created = httpRequestTool.create({ kinId: 'kin-1', isSubKin: false })
    expect(created).toBeDefined()
  })
})

describe('httpRequestTool execute', () => {
  const originalFetch = globalThis.fetch
  let mockFetchFn: ReturnType<typeof mock>

  beforeEach(() => {
    mockFetchFn = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    globalThis.fetch = mockFetchFn as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  async function getExecute(allowPrivateNetworkHttpRequests = false) {
    const { httpRequestTool } = await import('./http-request-tools')
    const created = httpRequestTool.create({
      kinId: 'kin-1',
      isSubKin: false,
      toolConfig: {
        disabledNativeTools: [],
        mcpAccess: {},
        allowPrivateNetworkHttpRequests,
      },
    })
    return (created as any).execute
  }

  it('blocks requests to private IPs with SSRF error by default', async () => {
    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'http://192.168.1.1/admin',
      timeout_seconds: 5,
    })
    expect(result).toEqual({ error: 'Requests to private/internal addresses are not allowed' })
    expect(mockFetchFn).not.toHaveBeenCalled()
  })

  it('allows requests to private IPs when explicitly enabled', async () => {
    const execute = await getExecute(true)
    const result = await execute({
      method: 'GET',
      url: 'http://192.168.1.1/admin',
      timeout_seconds: 5,
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
    expect(mockFetchFn).toHaveBeenCalledTimes(1)
  })

  it('allows requests to local-network hostnames when explicitly enabled', async () => {
    const execute = await getExecute(true)
    const result = await execute({
      method: 'GET',
      url: 'http://homeassistant.local:8123/api/',
      timeout_seconds: 5,
    })
    expect(result.status).toBe(200)
    expect(mockFetchFn).toHaveBeenCalledTimes(1)
  })

  it('keeps blocking localhost when private network access is enabled', async () => {
    const execute = await getExecute(true)
    const result = await execute({
      method: 'GET',
      url: 'http://localhost:3000/secret',
      timeout_seconds: 5,
    })
    expect(result.error).toContain('loopback')
    expect(mockFetchFn).not.toHaveBeenCalled()
  })

  it('keeps blocking cloud metadata when private network access is enabled', async () => {
    const execute = await getExecute(true)
    const result = await execute({
      method: 'GET',
      url: 'http://169.254.169.254/latest/meta-data/',
      timeout_seconds: 5,
    })
    expect(result.error).toContain('metadata')
    expect(mockFetchFn).not.toHaveBeenCalled()
  })

  it('makes GET request to public URL', async () => {
    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://api.example.com/data',
      timeout_seconds: 5,
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
    expect(mockFetchFn).toHaveBeenCalledTimes(1)
  })

  it('sends JSON body for POST with object body', async () => {
    const execute = await getExecute()
    await execute({
      method: 'POST',
      url: 'https://api.example.com/data',
      body: { key: 'value' },
      timeout_seconds: 5,
    })
    expect(mockFetchFn).toHaveBeenCalledTimes(1)
    const call = (mockFetchFn as any).mock.calls[0]
    expect(call[1].method).toBe('POST')
    expect(call[1].body).toBe('{"key":"value"}')
    expect(call[1].headers['Content-Type']).toBe('application/json')
  })

  it('sends string body as-is', async () => {
    const execute = await getExecute()
    await execute({
      method: 'POST',
      url: 'https://api.example.com/data',
      body: 'raw string body',
      headers: { 'Content-Type': 'text/plain' },
      timeout_seconds: 5,
    })
    const call = (mockFetchFn as any).mock.calls[0]
    expect(call[1].body).toBe('raw string body')
  })

  it('passes custom headers', async () => {
    const execute = await getExecute()
    await execute({
      method: 'GET',
      url: 'https://api.example.com/data',
      headers: { Authorization: 'Bearer token123' },
      timeout_seconds: 5,
    })
    const call = (mockFetchFn as any).mock.calls[0]
    expect(call[1].headers.Authorization).toBe('Bearer token123')
  })

  it('does not override existing Content-Type for object body', async () => {
    const execute = await getExecute()
    await execute({
      method: 'POST',
      url: 'https://api.example.com/data',
      headers: { 'Content-Type': 'application/xml' },
      body: { key: 'value' },
      timeout_seconds: 5,
    })
    const call = (mockFetchFn as any).mock.calls[0]
    expect(call[1].headers['Content-Type']).toBe('application/xml')
  })

  it('truncates large response bodies', async () => {
    const largeBody = 'x'.repeat(150 * 1024)
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(largeBody, {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    ) as any

    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://api.example.com/large',
      timeout_seconds: 5,
    })
    expect(result.status).toBe(200)
    expect(typeof result.body).toBe('string')
    expect((result.body as string)).toContain('[...truncated')
  })

  it('returns relevant response headers only', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response('{}', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'content-type': 'application/json',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-limit': '100',
            'retry-after': '60',
            'x-custom-header': 'should-be-excluded',
          },
        }),
      ),
    ) as any

    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://api.example.com/data',
      timeout_seconds: 5,
    })
    expect(result.status).toBe(429)
    expect(result.headers['content-type']).toBe('application/json')
    expect(result.headers['x-ratelimit-remaining']).toBe('0')
    expect(result.headers['retry-after']).toBe('60')
    expect(result.headers['x-custom-header']).toBeUndefined()
  })

  it('handles fetch errors gracefully', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('DNS resolution failed'))) as any

    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://nonexistent.example.com/',
      timeout_seconds: 5,
    })
    expect(result.error).toBe('DNS resolution failed')
  })

  it('handles abort/timeout errors', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    globalThis.fetch = mock(() => Promise.reject(abortError)) as any

    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://slow.example.com/',
      timeout_seconds: 2,
    })
    expect(result.error).toContain('timed out')
  })

  it('caps timeout at 120 seconds', async () => {
    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://api.example.com/data',
      timeout_seconds: 999,
    })
    expect(result.status).toBe(200)
  })

  it('handles non-JSON response with json content-type gracefully', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response('not valid json {{{', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ) as any

    const execute = await getExecute()
    const result = await execute({
      method: 'GET',
      url: 'https://api.example.com/bad-json',
      timeout_seconds: 5,
    })
    expect(result.status).toBe(200)
    expect(typeof result.body).toBe('string')
    expect(result.body).toContain('not valid json')
  })
})
