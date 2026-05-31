import { Hono } from 'hono'
import { createLogger } from '@/server/logger'
import { getEmailProvider, listEmailProviders } from '@/server/email/registry'
import {
  getOAuthClient,
  setOAuthClient,
  clearOAuthClient,
} from '@/server/services/app-settings'
import { buildAuthorizeUrl, exchangeCode, fetchAccountEmail } from '@/server/services/oauth'
import {
  listEmailAccounts,
  createOAuthEmailAccount,
  deleteEmailAccount,
  setSendMode,
  setAllowList,
  type SendMode,
} from '@/server/services/email-accounts'

const log = createLogger('routes:email-accounts')
const emailAccountRoutes = new Hono()

// Short-lived CSRF/state store for in-flight OAuth connects (in-memory).
const pendingStates = new Map<string, { type: string; createdAt: number }>()
const STATE_TTL_MS = 10 * 60 * 1000

function sweepStates() {
  const cutoff = Date.now() - STATE_TTL_MS
  for (const [k, v] of pendingStates) if (v.createdAt < cutoff) pendingStates.delete(k)
}

function callbackUri(reqUrl: string): string {
  return new URL('/api/email-accounts/oauth/callback', new URL(reqUrl).origin).toString()
}

// GET /api/email-accounts — list connected accounts (admin view: all accounts)
emailAccountRoutes.get('/', async (c) => {
  return c.json({ accounts: await listEmailAccounts() })
})

// GET /api/email-accounts/providers — available email providers + whether the
// operator has configured their OAuth app credentials.
emailAccountRoutes.get('/providers', async (c) => {
  const out = []
  for (const p of listEmailProviders()) {
    out.push({
      type: p.type,
      displayName: p.displayName,
      usesOAuth: !!p.oauth,
      oauthConfigured: p.oauth ? !!(await getOAuthClient(p.type)) : true,
      reactIcon: p.reactIcon ?? null,
      brandColor: p.brandColor ?? null,
    })
  }
  return c.json({ providers: out })
})

// GET /api/email-accounts/oauth-config/:type — is the OAuth app configured?
emailAccountRoutes.get('/oauth-config/:type', async (c) => {
  const client = await getOAuthClient(c.req.param('type'))
  return c.json({ configured: !!client, clientId: client?.clientId ?? null })
})

// PUT /api/email-accounts/oauth-config/:type — set the OAuth app credentials.
emailAccountRoutes.put('/oauth-config/:type', async (c) => {
  const type = c.req.param('type')
  const body = await c.req.json<{ clientId?: string; clientSecret?: string }>()
  if (!body.clientId || !body.clientSecret) {
    return c.json({ error: { code: 'INVALID_INPUT', message: 'clientId and clientSecret are required' } }, 400)
  }
  await setOAuthClient(type, { clientId: body.clientId, clientSecret: body.clientSecret })
  return c.json({ ok: true })
})

// DELETE /api/email-accounts/oauth-config/:type
emailAccountRoutes.delete('/oauth-config/:type', async (c) => {
  await clearOAuthClient(c.req.param('type'))
  return c.json({ ok: true })
})

// POST /api/email-accounts/connect/:type — begin the OAuth connect flow.
emailAccountRoutes.post('/connect/:type', async (c) => {
  const type = c.req.param('type')
  const provider = getEmailProvider(type)
  if (!provider) {
    return c.json({ error: { code: 'UNKNOWN_PROVIDER', message: `Unknown email provider: ${type}` } }, 404)
  }
  if (!provider.oauth) {
    return c.json({ error: { code: 'NOT_OAUTH', message: `${type} does not use OAuth` } }, 400)
  }
  const client = await getOAuthClient(type)
  if (!client) {
    return c.json(
      { error: { code: 'OAUTH_NOT_CONFIGURED', message: `OAuth app credentials not configured for ${type}` } },
      400,
    )
  }
  sweepStates()
  const state = crypto.randomUUID()
  pendingStates.set(state, { type, createdAt: Date.now() })
  const authUrl = buildAuthorizeUrl({
    profile: provider.oauth,
    clientId: client.clientId,
    redirectUri: callbackUri(c.req.url),
    state,
  })
  return c.json({ authUrl })
})

// GET /api/email-accounts/oauth/callback — OAuth redirect target.
emailAccountRoutes.get('/oauth/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const oauthError = c.req.query('error')
  if (oauthError) return c.redirect(`/?email_error=${encodeURIComponent(oauthError)}`)
  if (!code || !state) return c.redirect('/?email_error=missing_code')

  const pending = state ? pendingStates.get(state) : undefined
  if (!pending) return c.redirect('/?email_error=invalid_state')
  pendingStates.delete(state)

  const provider = getEmailProvider(pending.type)
  if (!provider?.oauth) return c.redirect('/?email_error=unknown_provider')
  const client = await getOAuthClient(pending.type)
  if (!client) return c.redirect('/?email_error=oauth_not_configured')

  try {
    const tokens = await exchangeCode({
      profile: provider.oauth,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      code,
      redirectUri: callbackUri(c.req.url),
    })
    if (!tokens.refreshToken) {
      // No refresh token means we'd lose access on expiry — usually because the
      // user previously granted consent. prompt=consent (in the profile) forces
      // a fresh refresh token, so this should be rare.
      return c.redirect('/?email_error=no_refresh_token')
    }
    const email = await fetchAccountEmail(provider.oauth, tokens.accessToken)
    if (!email) return c.redirect('/?email_error=no_email')
    await createOAuthEmailAccount({
      type: pending.type,
      emailAddress: email,
      refreshToken: tokens.refreshToken,
      scopes: tokens.scope ? tokens.scope.split(' ') : [...provider.oauth.scopes],
    })
    return c.redirect(`/?email_connected=${encodeURIComponent(email)}`)
  } catch (err) {
    log.error({ err, type: pending.type }, 'OAuth callback failed')
    return c.redirect(`/?email_error=${encodeURIComponent(err instanceof Error ? err.message : 'exchange_failed')}`)
  }
})

// PATCH /api/email-accounts/:id — update send mode / allow-list.
emailAccountRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ sendMode?: SendMode; allowedKinIds?: string[] | null }>()
  try {
    let account
    if (body.sendMode) account = await setSendMode(id, body.sendMode)
    if (body.allowedKinIds !== undefined) account = await setAllowList(id, body.allowedKinIds)
    if (!account) {
      return c.json({ error: { code: 'INVALID_INPUT', message: 'Nothing to update' } }, 400)
    }
    return c.json({ account })
  } catch (err) {
    return c.json({ error: { code: 'NOT_FOUND', message: err instanceof Error ? err.message : 'Not found' } }, 404)
  }
})

// DELETE /api/email-accounts/:id — disconnect an account.
emailAccountRoutes.delete('/:id', async (c) => {
  await deleteEmailAccount(c.req.param('id'))
  return c.json({ ok: true })
})

export { emailAccountRoutes }
