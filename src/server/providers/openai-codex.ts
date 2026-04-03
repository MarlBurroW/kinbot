/**
 * OpenAI provider using Codex CLI OAuth credentials.
 *
 * Instead of an API key, this provider reads OAuth tokens from the
 * Codex CLI auth file (~/.codex/auth.json) and refreshes them
 * automatically. The `apiKey` field in ProviderConfig is repurposed
 * as an optional override path to the credentials file.
 *
 * The Codex backend uses the OpenAI Responses API at
 * https://chatgpt.com/backend-api/codex/responses and is billed
 * against the user's ChatGPT subscription (Plus/Pro).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ProviderConfig, ProviderDefinition, ProviderModel } from '@/server/providers/types'
import { createLogger } from '@/server/logger'

const log = createLogger('provider:openai-codex')

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const TOKEN_URL = 'https://auth.openai.com/oauth/token'
export const CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex'
const BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

/**
 * Resolve the real user home directory.
 * Bun installed via snap sets HOME to a sandboxed path (e.g. ~/snap/bun-js/87/).
 * We prefer the REAL_HOME or the home from /etc/passwd via the USER env var.
 */
function getRealHome(): string {
  if (process.env.REAL_HOME) return process.env.REAL_HOME
  const home = process.env.HOME ?? ''
  const snapMatch = home.match(/^(\/home\/[^/]+)\/snap\//)
  if (snapMatch) return snapMatch[1]!
  if (process.env.USER) return `/home/${process.env.USER}`
  return home
}

const REAL_HOME = getRealHome()

const CANDIDATE_PATHS = [
  join(REAL_HOME, '.codex', 'auth.json'),
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CodexAuthFile {
  auth_mode: string
  tokens: {
    access_token: string
    refresh_token: string
    id_token: string
    account_id: string
  }
  last_refresh: string
}

// ---------------------------------------------------------------------------
// Hardcoded models (the Codex backend has no /models endpoint)
// ---------------------------------------------------------------------------
const CODEX_MODELS: ProviderModel[] = [
  { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', capability: 'llm' },
  { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', capability: 'llm' },
  { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', capability: 'llm' },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', capability: 'llm' },
  { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', capability: 'llm' },
  { id: 'gpt-5-codex', name: 'GPT-5 Codex', capability: 'llm' },
  { id: 'gpt-5-codex-mini', name: 'GPT-5 Codex Mini', capability: 'llm' },
]

// ---------------------------------------------------------------------------
// Credentials path resolution
// ---------------------------------------------------------------------------
function resolveCredsPath(overridePath?: string): string {
  if (overridePath && overridePath.trim().length > 0) {
    if (!existsSync(overridePath)) {
      throw new Error(`Codex credentials file not found at: ${overridePath}`)
    }
    return overridePath
  }

  for (const candidate of CANDIDATE_PATHS) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Codex CLI credentials file not found. Searched: ${CANDIDATE_PATHS.join(', ')}. ` +
      'Make sure Codex CLI is installed and authenticated (codex login), or provide the path explicitly.',
  )
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function decodeJwtExpiry(token: string): number {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return 0
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString())
    return (payload.exp ?? 0) * 1000 // convert to ms
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------
async function refreshToken(
  refreshTok: string,
): Promise<{ access_token: string; refresh_token: string; id_token?: string }> {
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
    throw new Error(`Codex OAuth token refresh failed (${resp.status}): ${text}`)
  }

  return resp.json() as Promise<{
    access_token: string
    refresh_token: string
    id_token?: string
  }>
}

// ---------------------------------------------------------------------------
// Credential management — single-flight refresh
// ---------------------------------------------------------------------------
let cachedToken: { accessToken: string; accountId: string; expiresAt: number } | null = null
let refreshPromise: Promise<{ accessToken: string; accountId: string }> | null = null

async function ensureFreshToken(credsPath: string): Promise<{ accessToken: string; accountId: string }> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > BUFFER_MS) {
    return { accessToken: cachedToken.accessToken, accountId: cachedToken.accountId }
  }

  if (!refreshPromise) {
    refreshPromise = doRefresh(credsPath).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function doRefresh(credsPath: string): Promise<{ accessToken: string; accountId: string }> {
  const raw = readFileSync(credsPath, 'utf8')
  const creds: CodexAuthFile = JSON.parse(raw)
  const tokens = creds.tokens
  const now = Date.now()
  const accountId = tokens.account_id

  // Check if current token is still fresh
  const expiresAt = decodeJwtExpiry(tokens.access_token)
  if (expiresAt && expiresAt - now > BUFFER_MS) {
    cachedToken = { accessToken: tokens.access_token, accountId, expiresAt }
    return { accessToken: tokens.access_token, accountId }
  }

  // Refresh the token
  const data = await refreshToken(tokens.refresh_token)
  log.info('Codex OAuth token refreshed successfully')

  const newExpiresAt = decodeJwtExpiry(data.access_token)

  // Write back to auth.json so the Codex CLI also sees the refreshed token
  creds.tokens = {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    ...(data.id_token ? { id_token: data.id_token } : {}),
  }
  creds.last_refresh = new Date().toISOString()

  writeFileSync(credsPath, JSON.stringify(creds, null, 2))
  cachedToken = { accessToken: data.access_token, accountId, expiresAt: newExpiresAt }

  return { accessToken: data.access_token, accountId }
}

// ---------------------------------------------------------------------------
// Provider definition
// ---------------------------------------------------------------------------

/**
 * Get a fresh OAuth access token and account ID for the Codex backend.
 */
export async function getCodexOAuthCredentials(overridePath?: string): Promise<{ accessToken: string; accountId: string }> {
  const credsPath = resolveCredsPath(overridePath)
  return ensureFreshToken(credsPath)
}

export const openaiCodexProvider: ProviderDefinition = {
  type: 'openai-codex',

  async testConnection(config: ProviderConfig) {
    try {
      const credsPath = resolveCredsPath(config.apiKey || undefined)
      const { accessToken, accountId } = await ensureFreshToken(credsPath)

      // Make a minimal streaming request to verify credentials work
      const response = await fetch(`${CODEX_BASE_URL}/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'ChatGPT-Account-ID': accountId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.3-codex',
          instructions: 'Reply with exactly one word.',
          input: [{ role: 'user', content: 'Say hi' }],
          store: false,
          stream: true,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Codex API error (${response.status}): ${text}`)
      }

      // Consume the stream to avoid connection leaks
      if (response.body) {
        const reader = response.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      log.info('Codex connection test passed')
      return { valid: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      log.error({ err: error }, 'Codex connection test failed')
      return { valid: false, error: message }
    }
  },

  async listModels(_config: ProviderConfig) {
    // The Codex backend has no /models endpoint — return hardcoded list
    return CODEX_MODELS
  },
}
