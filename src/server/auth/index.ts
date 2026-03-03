import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError } from 'better-auth/api'
import { db } from '@/server/db/index'
import * as schema from '@/server/db/schema'
import { config } from '@/server/config'

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
    disableSignUp: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',')
    : [
        config.publicUrl,
        'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
        'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:3000',
      ],
})

export type Session = typeof auth.$Infer.Session
