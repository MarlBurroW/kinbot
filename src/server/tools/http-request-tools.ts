import { tool } from 'ai'
import { z } from 'zod'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:http-request')

const MAX_RESPONSE_BODY = 100 * 1024 // 100KB
const DEFAULT_TIMEOUT = 30_000

/**
 * Check if a URL resolves to a private/internal IP range (basic SSRF protection).
 */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const host = url.hostname
    // Block common private ranges and metadata endpoints
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.2') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.') ||
      host === '169.254.169.254' || // AWS metadata
      host.endsWith('.internal') ||
      host.endsWith('.local')
    ) {
      return true
    }
    return false
  } catch {
    return true
  }
}

/**
 * http_request - Make HTTP requests to external APIs.
 * Available to main agents only.
 */
export const httpRequestTool: ToolRegistration = {
  availability: ['main'],
  create: () =>
    tool({
      description:
        'Make an HTTP request to an external URL. Supports GET, POST, PUT, PATCH, DELETE. ' +
        'Returns the response status, headers, and body (truncated to 100KB). ' +
        'Cannot access private/internal IPs (SSRF protection).',
      inputSchema: z.object({
        method: z
          .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
          .describe('HTTP method'),
        url: z.string().url().describe('Target URL (must be http:// or https://)'),
        headers: z
          .record(z.string())
          .optional()
          .describe('Request headers as key-value pairs'),
        body: z
          .union([z.string(), z.record(z.unknown())])
          .optional()
          .describe('Request body. Objects are auto-serialized to JSON.'),
        timeout_seconds: z
          .number()
          .optional()
          .default(30)
          .describe('Request timeout in seconds (default 30, max 120)'),
      }),
      execute: async ({ method, url, headers, body, timeout_seconds }) => {
        // SSRF protection
        if (isPrivateUrl(url)) {
          return { error: 'Requests to private/internal addresses are not allowed' }
        }

        const timeout = Math.min((timeout_seconds ?? 30) * 1000, 120_000)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        try {
          const fetchHeaders: Record<string, string> = { ...headers }

          let fetchBody: string | undefined
          if (body !== undefined) {
            if (typeof body === 'object') {
              fetchBody = JSON.stringify(body)
              if (!fetchHeaders['Content-Type'] && !fetchHeaders['content-type']) {
                fetchHeaders['Content-Type'] = 'application/json'
              }
            } else {
              fetchBody = body
            }
          }

          log.debug({ method, url }, 'HTTP request')

          const response = await fetch(url, {
            method,
            headers: fetchHeaders,
            body: fetchBody,
            signal: controller.signal,
            redirect: 'follow',
          })

          // Read response body with size limit
          const contentType = response.headers.get('content-type') ?? ''
          let responseBody: string

          const buffer = await response.arrayBuffer()
          const bytes = new Uint8Array(buffer)

          if (bytes.length > MAX_RESPONSE_BODY) {
            responseBody = new TextDecoder().decode(bytes.slice(0, MAX_RESPONSE_BODY))
            responseBody += `\n\n[...truncated, response was ${bytes.length} bytes]`
          } else {
            responseBody = new TextDecoder().decode(bytes)
          }

          // Try to parse JSON for cleaner output
          let parsedBody: unknown = responseBody
          if (contentType.includes('application/json')) {
            try {
              parsedBody = JSON.parse(responseBody)
            } catch {
              // Keep as string
            }
          }

          // Extract relevant response headers
          const responseHeaders: Record<string, string> = {}
          for (const key of ['content-type', 'content-length', 'x-ratelimit-remaining', 'x-ratelimit-limit', 'retry-after', 'location']) {
            const val = response.headers.get(key)
            if (val) responseHeaders[key] = val
          }

          return {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: parsedBody,
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return { error: `Request timed out after ${timeout / 1000}s` }
          }
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        } finally {
          clearTimeout(timer)
        }
      },
    }),
}
