import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { db } from '@/server/db/index'
import * as schema from '@/server/db/schema'
import { config } from '@/server/config'

/**
 * Check whether a hostname is a private/loopback address.
 * Covers RFC 1918 (10.x, 172.16-31.x, 192.168.x), loopback (127.x, ::1),
 * link-local (169.254.x, fe80::), and localhost aliases.
 */
function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '::1') return true
  // IPv6 bracket notation (e.g. [::1])
  const h = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fd')) return true
  // IPv4 private ranges
  const parts = h.split('.').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return false
  const [a, b] = parts
  if (a === 127) return true                    // 127.0.0.0/8
  if (a === 10) return true                     // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true       // 192.168.0.0/16
  if (a === 169 && b === 254) return true       // 169.254.0.0/16 (link-local)
  return false
}

/** Static list of always-trusted origins (publicUrl + dev servers). */
const STATIC_TRUSTED_ORIGINS = [
  config.publicUrl,
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:3000',
]

/**
 * Build the trustedOrigins config for Better Auth.
 *
 * When TRUSTED_ORIGINS is explicitly set, use that list verbatim.
 * Otherwise, use a dynamic function that auto-trusts any origin from
 * a private/loopback IP — essential for Docker and LAN access where
 * users access KinBot via their NAS/server IP (e.g. http://192.168.1.5:3000).
 */
function buildTrustedOrigins(): string[] | ((request: Request) => Promise<string[]>) {
  if (process.env.TRUSTED_ORIGINS) {
    return process.env.TRUSTED_ORIGINS.split(',')
  }

  return async (request: Request) => {
    const origins = [...STATIC_TRUSTED_ORIGINS]
    const origin = request.headers.get('origin')
    if (origin) {
      try {
        const url = new URL(origin)
        if (isPrivateHost(url.hostname)) {
          origins.push(origin)
        }
      } catch {
        // Invalid origin URL — ignore
      }
    }
    return origins
  }
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? config.publicUrl,
  secret: process.env.BETTER_AUTH_SECRET ?? config.encryptionKey,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Note: open sign-up is gated at the application layer, not here.
    // The onboarding /profile endpoint requires a valid invitation token
    // when an admin already exists. Without a profile, an auth-only user
    // cannot access any protected routes (the /me endpoint returns 404,
    // and the client redirects to onboarding). This is safer than
    // disableSignUp:true which also blocks the onboarding & invitation flows.
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  trustedOrigins: buildTrustedOrigins(),
})

export type Session = typeof auth.$Infer.Session
