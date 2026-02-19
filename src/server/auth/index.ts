import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/server/db/index'
import * as schema from '@/server/db/schema'

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? 'http://localhost:3000',
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
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  trustedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
})

export type Session = typeof auth.$Infer.Session
