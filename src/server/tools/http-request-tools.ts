import { tool } from 'ai'
import { z } from 'zod'
import { createLogger } from '@/server/logger'
import type { ToolExecutionContext, ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:http-request')

const MAX_RESPONSE_BODY = 100 * 1024 // 100KB
const DEFAULT_TIMEOUT = 30_000

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

/**
 * Check whether a URL is safe for http_request.
 *
 * Loopback, unspecified addresses, link-local metadata endpoints, and invalid
 * URLs are always blocked. RFC1918 IPv4 ranges and local-network hostnames can
 * be allowed per Kin through toolConfig.allowPrivateNetworkHttpRequests.
 */
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

/**
 * http_request - Make HTTP requests to external APIs.
 * Available to main agents only.
 */
export const httpRequestTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (ctx: ToolExecutionContext) => {
    const allowPrivateNetwork = ctx.toolConfig?.allowPrivateNetworkHttpRequests === true
    return tool({
      description: allowPrivateNetwork
        ? 'Make an HTTP request to an external URL. RFC1918 and local-network addresses are allowed for this Kin, but loopback and metadata endpoints are still blocked.'
        : 'Make an HTTP request to an external URL. Private/internal IPs are blocked.',
      inputSchema: z.object({
        method: z
          .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        url: z.string().url(),
        headers: z
          .object({})
          .catchall(z.string())
          .optional()
          .describe('HTTP headers as key-value pairs (e.g. {"Authorization": "Bearer token"})'),
        body: z
          .union([z.string(), z.record(z.string(), z.unknown())])
          .optional()
          .describe('Objects auto-serialized to JSON'),
        timeout_seconds: z
          .number()
          .optional()
          .default(30)
          .describe('Default: 30, max: 120'),
      }),
      execute: async ({ method, url, headers, body, timeout_seconds }) => {
        // SSRF protection
        const urlSafety = checkUrlSafety(url, allowPrivateNetwork)
        if (!urlSafety.allowed) {
          return { error: urlSafety.reason }
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

          log.debug({ method, url, privateNetwork: urlSafety.privateNetwork }, 'HTTP request')

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
    })
  },
}
