import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { userProfiles, user, kins } from '@/server/db/schema'
import { createNotificationForUser } from '@/server/services/notifications'
import { MENTION_REGEX } from '@/shared/constants'
import { createLogger } from '@/server/logger'

const log = createLogger('mentions')

export interface ParsedMention {
  raw: string       // "@alice"
  handle: string    // "alice"
  type: 'user' | 'kin'
  id: string        // resolved UUID
  name: string      // display name
}

/**
 * Parse @mentions from message content and resolve them to users or kins.
 * Matches against user_profiles.pseudonym (case-insensitive) then kins.slug.
 */
export async function parseMentions(content: string): Promise<ParsedMention[]> {
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
  const handles = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    handles.add(match[1]!.toLowerCase())
  }

  if (handles.size === 0) return []

  // Fetch all users and kins once (small dataset — self-hosted for individuals/small groups)
  const [allProfiles, allKins] = await Promise.all([
    db.select({
      userId: userProfiles.userId,
      pseudonym: userProfiles.pseudonym,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    }).from(userProfiles).all(),
    db.select({
      id: kins.id,
      slug: kins.slug,
      name: kins.name,
    }).from(kins).all(),
  ])

  const mentions: ParsedMention[] = []
  const resolved = new Set<string>()

  for (const handle of handles) {
    // Try user first (pseudonym, case-insensitive)
    const userMatch = allProfiles.find(
      (p) => p.pseudonym.toLowerCase() === handle,
    )
    if (userMatch) {
      mentions.push({
        raw: `@${handle}`,
        handle,
        type: 'user',
        id: userMatch.userId,
        name: `${userMatch.firstName} ${userMatch.lastName}`.trim(),
      })
      resolved.add(handle)
      continue
    }

    // Try kin (slug, case-insensitive)
    const kinMatch = allKins.find(
      (k) => k.slug?.toLowerCase() === handle || k.name.toLowerCase() === handle,
    )
    if (kinMatch) {
      mentions.push({
        raw: `@${handle}`,
        handle,
        type: 'kin',
        id: kinMatch.id,
        name: kinMatch.name,
      })
      resolved.add(handle)
    }
  }

  return mentions
}

/**
 * Send a notification to each mentioned user.
 * Kin mentions are ignored (visual only).
 */
export async function notifyMentionedUsers(
  mentions: ParsedMention[],
  kinId: string,
  messageId: string,
  senderName: string,
): Promise<void> {
  const userMentions = mentions.filter((m) => m.type === 'user')
  if (userMentions.length === 0) return

  for (const mention of userMentions) {
    try {
      await createNotificationForUser(mention.id, {
        type: 'mention',
        title: senderName,
        body: undefined,
        kinId,
        relatedId: messageId,
        relatedType: 'message',
      })
    } catch (err) {
      log.error({ err, userId: mention.id, messageId }, 'Failed to notify mentioned user')
    }
  }
}
