/**
 * Anthropic provider using Claude Code Max OAuth credentials.
 *
 * Instead of an API key, this provider reads OAuth tokens from the
 * Claude Code credentials file (~/.claude/.credentials.json) and refreshes them
 * automatically. The `apiKey` field in ProviderConfig is repurposed
 * as an optional override path to the credentials file.
 *
 * Based on: https://github.com/bardak971/amnesia/blob/main/shared/src/oauth.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:anthropic-oauth')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token'
const CLAUDE_CODE_VERSION = '2.1.2'
const BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

/**
 * Resolve the real user home directory.
 * Bun installed via snap sets HOME to a sandboxed path (e.g. ~/snap/bun-js/87/).
 * We prefer the REAL_HOME or the home from /etc/passwd via the USER env var.
 */
function getRealHome(): string {
  // REAL_HOME is set by some snap environments
  if (process.env.REAL_HOME) return process.env.REAL_HOME
  // Fall back to HOME, but strip snap paths
  const home = process.env.HOME ?? ''
  const snapMatch = home.match(/^(\/home\/[^/]+)\/snap\//)
  if (snapMatch) return snapMatch[1]
  // Last resort: construct from USER
  if (process.env.USER) return `/home/${process.env.USER}`
  return home
}

const REAL_HOME = getRealHome()

const CANDIDATE_PATHS = [
  join(REAL_HOME, '.claude', '.credentials.json'),
  join(REAL_HOME, '.claude.json'),
  join(REAL_HOME, '.claude', 'credentials.json'),
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OAuthCredentials {
  claudeAiOauth: {
    accessToken: string
    refreshToken: string
    expiresAt: number
    [key: string]: unknown
  }
}

interface AnthropicModel {
  id: string
  display_name: string
  type: string
}

interface AnthropicModelsResponse {
  data: AnthropicModel[]
}

// ---------------------------------------------------------------------------
// Credentials path resolution
// ---------------------------------------------------------------------------
function resolveCredsPath(overridePath?: string): string {
  if (overridePath && overridePath.trim().length > 0) {
    if (!existsSync(overridePath)) {
      throw new Error(`Credentials file not found at: ${overridePath}`)
    }
    return overridePath
  }

  for (const candidate of CANDIDATE_PATHS) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Claude Code credentials file not found. Searched: ${CANDIDATE_PATHS.join(', ')}. ` +
      'Make sure Claude Code CLI is installed and authenticated, or provide the path explicitly.',
  )
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------
async function refreshToken(
  refreshTok: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshTok,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`OAuth token refresh failed (${resp.status}): ${text}`)
  }

  return resp.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

// ---------------------------------------------------------------------------
// Credential management — single-flight refresh
// ---------------------------------------------------------------------------
let cachedToken: { accessToken: string; expiresAt: number } | null = null
let refreshPromise: Promise<string> | null = null

async function ensureFreshToken(credsPath: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > BUFFER_MS) {
    return cachedToken.accessToken
  }

  if (!refreshPromise) {
    refreshPromise = doRefresh(credsPath).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(credsPath: string): Promise<string> {
  const raw = readFileSync(credsPath, 'utf8')
  const creds: OAuthCredentials = JSON.parse(raw)
  const oauth = creds.claudeAiOauth
  const now = Date.now()

  // Re-check after acquiring the "lock"
  if (oauth.expiresAt && oauth.expiresAt - now > BUFFER_MS) {
    cachedToken = { accessToken: oauth.accessToken, expiresAt: oauth.expiresAt }
    return oauth.accessToken
  }

  const data = await refreshToken(oauth.refreshToken)
  log.info('OAuth token refreshed successfully')

  const expiresAt = now + data.expires_in * 1000 - BUFFER_MS
  creds.claudeAiOauth = {
    ...oauth,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  }

  writeFileSync(credsPath, JSON.stringify(creds, null, 2))
  cachedToken = { accessToken: data.access_token, expiresAt }

  return data.access_token
}

// ---------------------------------------------------------------------------
// Fetch models using OAuth token
// ---------------------------------------------------------------------------
async function fetchAnthropicModelsOAuth(credsPath: string): Promise<AnthropicModel[]> {
  const accessToken = await ensureFreshToken(credsPath)

  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': [
        'claude-code-20250219',
        'oauth-2025-04-20',
        'fine-grained-tool-streaming-2025-05-14',
      ].join(','),
      'user-agent': `claude-cli/${CLAUDE_CODE_VERSION} (external, cli)`,
      'x-app': 'cli',
    },
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = (await response.json()) as AnthropicModelsResponse
  return data.data
}

// ---------------------------------------------------------------------------
// Provider definition
// ---------------------------------------------------------------------------

/**
 * Get a fresh OAuth access token for the Anthropic API.
 * Useful for external callers (e.g. the Kin engine) that need
 * the token to pass to the Vercel AI SDK.
 */
export async function getOAuthAccessToken(overridePath?: string): Promise<string> {
  const credsPath = resolveCredsPath(overridePath)
  return ensureFreshToken(credsPath)
}

/** Headers required when using OAuth tokens with the Anthropic API. */
export const OAUTH_HEADERS = {
  'anthropic-dangerous-direct-browser-access': 'true',
  'anthropic-beta': [
    'claude-code-20250219',
    'oauth-2025-04-20',
    'fine-grained-tool-streaming-2025-05-14',
  ].join(','),
  'user-agent': `claude-cli/${CLAUDE_CODE_VERSION} (external, cli)`,
  'x-app': 'cli',
} as const

/**
 * Magic system block required by the Anthropic OAuth endpoint.
 * The server validates the first system block is this exact string.
 */
export const REQUIRED_SYSTEM_BLOCK = {
  type: 'text' as const,
  text: 'You are Claude Code, Anthropic\'s official CLI for Claude.',
  cache_control: { type: 'ephemeral' as const },
}

export const anthropicOAuthProvider: ProviderDefinition = {
  type: 'anthropic-oauth',
  capabilities: ['llm'],

  async testConnection(config: ProviderConfig) {
    try {
      const credsPath = resolveCredsPath(config.apiKey)
      const models = await fetchAnthropicModelsOAuth(credsPath)
      const valid = models.length > 0
      log.info({ valid, modelCount: models.length }, 'Connection test completed')
      return { valid }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      log.error({ err: error }, 'Connection test failed')
      return { valid: false, error: message }
    }
  },

  async listModels(config: ProviderConfig) {
    try {
      const credsPath = resolveCredsPath(config.apiKey)
      const apiModels = await fetchAnthropicModelsOAuth(credsPath)
      const models = apiModels
        .filter((m) => m.type === 'model')
        .map((m): ProviderModel => ({
          id: m.id,
          name: m.display_name,
          capability: 'llm',
        }))
      log.debug({ count: models.length }, 'Models listed')
      return models
    } catch (error) {
      log.error({ err: error }, 'Failed to list models')
      return []
    }
  },
}
