/**
 * KinBot plugin: twilio-sms
 *
 * Channel adapter that sends and receives SMS via Twilio:
 *   - outbound: POST to https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
 *   - inbound: signed webhook at /api/channels/plugin/twilio-sms/webhook/{channelId}
 *
 * Inbound webhooks are authenticated with strict HMAC-SHA1 against the Auth
 * Token (see webhookSecurity.ts). Missing or invalid signature -> HTTP 403.
 */

import type {
  ChannelAdapter,
  IncomingMessage,
  IncomingMessageHandler,
  OutboundMessageParams,
  OutboundMessageResult,
  PluginContext,
} from '@kinbot-developer/sdk'
import { getAccount, sendSms, TwilioApiException, type TwilioAuth } from './twilioApi'
import { validateTwilioSignature } from './webhookSecurity'

// ─── Resolved channel config shape ──────────────────────────────────────────
// Stored in `channels.platformConfig` as JSON. The Auth Token is a password
// field so KinBot replaces it with `authTokenVaultKey` on persistence; the
// real value is fetched via `ctx.vault.getSecret()` at use time. Plain-text
// fallback is supported for tests and dev-time fixtures.

export interface TwilioChannelConfig {
  accountSid: string
  authToken?: string
  authTokenVaultKey?: string
  fromNumber: string
}

async function resolveAuth(
  ctx: PluginContext,
  config: Record<string, unknown>,
): Promise<TwilioAuth> {
  const cfg = config as Partial<TwilioChannelConfig>
  if (!cfg.accountSid || typeof cfg.accountSid !== 'string') {
    throw new Error('Twilio channel config missing accountSid')
  }
  let token = typeof cfg.authToken === 'string' ? cfg.authToken : ''
  if (!token && typeof cfg.authTokenVaultKey === 'string') {
    const fromVault = await ctx.vault.getSecret(cfg.authTokenVaultKey)
    if (!fromVault) {
      throw new Error(`Twilio Auth Token vault key "${cfg.authTokenVaultKey}" not found`)
    }
    token = fromVault
  }
  if (!token) {
    throw new Error('Twilio channel config missing authToken (or authTokenVaultKey)')
  }
  return { accountSid: cfg.accountSid, authToken: token }
}

function requireFromNumber(config: Record<string, unknown>): string {
  const cfg = config as Partial<TwilioChannelConfig>
  if (!cfg.fromNumber || typeof cfg.fromNumber !== 'string') {
    throw new Error('Twilio channel config missing fromNumber')
  }
  return cfg.fromNumber
}

const E164_RE = /^\+[1-9]\d{1,14}$/

// Empty TwiML response: tells Twilio "received, no auto-reply". The Kin
// owns the reply path via sendMessage; we never let Twilio auto-respond.
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

// ─── Plugin entry point ─────────────────────────────────────────────────────

export default function twilioSmsPlugin(ctx: PluginContext): {
  channels: { 'twilio-sms': ChannelAdapter }
  activate?: () => Promise<void>
  deactivate?: () => Promise<void>
} {
  const adapter: ChannelAdapter = {
    platform: 'twilio-sms',
    meta: {
      displayName: 'Twilio SMS',
      brandColor: '#F22F46',
    },
    // SMS has no concept of a bot display name on the recipient's side: the
    // From is just a phone number. Fall back to the core's "[Kin Name] "
    // prefix on outbound texts so the recipient knows which Kin is replying.
    identitySwitchMode: 'prefix',

    async start(
      channelId: string,
      _config: Record<string, unknown>,
      _onMessage: IncomingMessageHandler,
    ): Promise<void> {
      // Twilio is webhook-driven; nothing to start at the transport layer.
      // The dispatcher route invokes handleInboundWebhook on each request.
      ctx.log.info({ channelId }, 'twilio-sms channel started')
    },

    async stop(channelId: string): Promise<void> {
      ctx.log.info({ channelId }, 'twilio-sms channel stopped')
    },

    async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
      try {
        const auth = await resolveAuth(ctx, config)
        const fromNumber = (config as Partial<TwilioChannelConfig>).fromNumber
        if (!fromNumber || !E164_RE.test(fromNumber)) {
          return { valid: false, error: 'fromNumber must be E.164 (e.g. +15551234567)' }
        }
        const account = await getAccount(auth)
        if (account.status && account.status !== 'active') {
          return { valid: false, error: `Twilio account is not active (status: ${account.status})` }
        }
        return { valid: true }
      } catch (err) {
        if (err instanceof TwilioApiException) {
          return { valid: false, error: err.message }
        }
        return { valid: false, error: err instanceof Error ? err.message : String(err) }
      }
    },

    async getBotInfo(config: Record<string, unknown>): Promise<{ name: string; username?: string } | null> {
      const cfg = config as Partial<TwilioChannelConfig>
      try {
        const auth = await resolveAuth(ctx, config)
        const account = await getAccount(auth)
        return {
          name: account.friendly_name || 'Twilio SMS',
          username: cfg.fromNumber ?? undefined,
        }
      } catch (err) {
        ctx.log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'twilio-sms getBotInfo failed; returning fallback',
        )
        return { name: 'Twilio SMS', username: cfg.fromNumber ?? undefined }
      }
    },

    async sendMessage(
      _channelId: string,
      config: Record<string, unknown>,
      params: OutboundMessageParams,
    ): Promise<OutboundMessageResult> {
      const auth = await resolveAuth(ctx, config)
      const from = requireFromNumber(config)
      const to = params.chatId
      if (!E164_RE.test(to)) {
        throw new Error(`Recipient ${to} is not in E.164 format (must start with + and 8-15 digits)`)
      }
      const body = (params.content ?? '').trim()
      if (!body) {
        throw new Error('Cannot send empty SMS body')
      }
      const result = await sendSms({ auth, from, to, body })
      ctx.log.info(
        { sid: result.sid, status: result.status, to, from },
        'twilio-sms message sent',
      )
      return {
        platformMessageId: result.sid,
        deliveryMeta: {
          twilio: { status: result.status, to, from },
        },
      }
    },

    async handleInboundWebhook(
      _channelId: string,
      config: Record<string, unknown>,
      req: Request,
    ): Promise<{ incoming: IncomingMessage | null; response: Response }> {
      const auth = await resolveAuth(ctx, config)

      // Reconstruct the canonical URL Twilio used to sign. Twilio always
      // signs the public URL configured in the console, so we prefer
      // PUBLIC_URL (joined to the request path) over req.url, which inside
      // KinBot would resolve to a localhost host behind a reverse proxy.
      const reqUrl = new URL(req.url)
      const publicBase = (process.env.PUBLIC_URL ?? reqUrl.origin).replace(/\/$/, '')
      const fullUrl = `${publicBase}${reqUrl.pathname}${reqUrl.search}`

      const rawBody = await req.text()
      const params = new URLSearchParams(rawBody)
      const signature = req.headers.get('x-twilio-signature')

      if (!validateTwilioSignature(auth.authToken, signature, fullUrl, params)) {
        ctx.log.warn(
          { fullUrl, hasSig: signature !== null },
          'twilio-sms rejected webhook: invalid signature',
        )
        return {
          incoming: null,
          response: new Response('Forbidden: invalid Twilio signature', { status: 403 }),
        }
      }

      const from = params.get('From') ?? ''
      const to = params.get('To') ?? ''
      const body = params.get('Body') ?? ''
      const messageSid = params.get('MessageSid') ?? params.get('SmsSid') ?? ''
      const accountSid = params.get('AccountSid') ?? auth.accountSid
      const numMedia = Number.parseInt(params.get('NumMedia') ?? '0', 10) || 0

      if (!from || !messageSid) {
        ctx.log.warn(
          { from, messageSid, hasBody: body.length > 0 },
          'twilio-sms received signed webhook with missing required fields; acking without injecting',
        )
        // Still 200 so Twilio does not retry; we just don't enqueue garbage.
        return {
          incoming: null,
          response: new Response(EMPTY_TWIML, {
            status: 200,
            headers: { 'Content-Type': 'application/xml' },
          }),
        }
      }

      const incoming: IncomingMessage = {
        platformUserId: from,
        platformUsername: from,
        platformDisplayName: from,
        platformMessageId: messageSid,
        platformChatId: from,
        content: body,
        metadata: {
          twilio: { accountSid, toNumber: to, numMedia },
        },
      }

      return {
        incoming,
        response: new Response(EMPTY_TWIML, {
          status: 200,
          headers: { 'Content-Type': 'application/xml' },
        }),
      }
    },
  }

  return {
    channels: { 'twilio-sms': adapter },

    async activate(): Promise<void> {
      ctx.log.info({ plugin: ctx.manifest.name, version: ctx.manifest.version }, 'twilio-sms plugin activated')
    },

    async deactivate(): Promise<void> {
      ctx.log.info('twilio-sms plugin deactivated')
    },
  }
}
