import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@/server/db/index'
import { user, userProfiles } from '@/server/db/schema'
import { eq, or, like } from 'drizzle-orm'
import { createInvitation, buildInvitationUrl } from '@/server/services/invitations'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:users')

/**
 * list_users — list all platform users.
 * Available to main agents only.
 */
export const listUsersTool: ToolRegistration = {
  availability: ['main'],
  create: (_ctx) =>
    tool({
      description:
        'List all platform users with their pseudonym, first name, language, and role. ' +
        'Use this to know who is on the platform.',
      inputSchema: z.object({}),
      execute: async () => {
        const users = db
          .select({
            id: user.id,
            pseudonym: userProfiles.pseudonym,
            firstName: userProfiles.firstName,
            lastName: userProfiles.lastName,
            language: userProfiles.language,
            role: userProfiles.role,
          })
          .from(user)
          .innerJoin(userProfiles, eq(user.id, userProfiles.userId))
          .all()

        return { users, count: users.length }
      },
    }),
}

/**
 * get_user — get details of a specific platform user.
 * Available to main agents only.
 */
export const getUserTool: ToolRegistration = {
  availability: ['main'],
  create: (_ctx) =>
    tool({
      description:
        'Get details of a specific platform user by their ID or pseudonym. ' +
        'Returns their name, email, language, role, and avatar.',
      inputSchema: z.object({
        identifier: z.string().describe('User ID or pseudonym to look up'),
      }),
      execute: async ({ identifier }) => {
        // Try by ID first
        let found = db
          .select({
            id: user.id,
            firstName: userProfiles.firstName,
            lastName: userProfiles.lastName,
            pseudonym: userProfiles.pseudonym,
            email: user.email,
            language: userProfiles.language,
            role: userProfiles.role,
            avatarUrl: user.image,
          })
          .from(user)
          .innerJoin(userProfiles, eq(user.id, userProfiles.userId))
          .where(eq(user.id, identifier))
          .get()

        // Try by pseudonym if not found by ID
        if (!found) {
          found = db
            .select({
              id: user.id,
              firstName: userProfiles.firstName,
              lastName: userProfiles.lastName,
              pseudonym: userProfiles.pseudonym,
              email: user.email,
              language: userProfiles.language,
              role: userProfiles.role,
              avatarUrl: user.image,
            })
            .from(user)
            .innerJoin(userProfiles, eq(user.id, userProfiles.userId))
            .where(like(userProfiles.pseudonym, identifier))
            .get()
        }

        if (!found) {
          return { error: 'User not found' }
        }

        return found
      },
    }),
}

/**
 * create_invitation — generate an invitation link.
 * Available to main agents only.
 */
export const createInvitationTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Generate an invitation link for a new user to join the platform. ' +
        'Share this link with the person you want to invite. ' +
        'The link expires after the specified number of days (default 7).',
      inputSchema: z.object({
        label: z
          .string()
          .optional()
          .describe('Optional label to identify who this invitation is for (e.g. "For Mom", "For the team")'),
        expires_in_days: z
          .number()
          .optional()
          .default(7)
          .describe('Number of days before the invitation expires (default 7)'),
      }),
      execute: async ({ label, expires_in_days }) => {
        log.debug({ kinId: ctx.kinId, label }, 'Invitation creation requested by Kin')
        try {
          const invitation = await createInvitation({
            createdBy: ctx.userId ?? 'system',
            label,
            kinId: ctx.kinId,
            expiresInDays: expires_in_days,
          })
          return {
            invitationId: invitation.id,
            url: invitation.url,
            label: invitation.label,
            expiresAt: invitation.expiresAt,
            message: 'Invitation created. Share this link with the person you want to invite.',
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      },
    }),
}
