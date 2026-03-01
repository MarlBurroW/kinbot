import { memo, useMemo } from 'react'
import { useSearchHighlight } from '@/client/components/chat/SearchHighlightContext'
import { useMentionLookup } from '@/client/components/chat/MentionContext'
import { MENTION_REGEX } from '@/shared/constants'

/**
 * Renders text with @mention pills and search highlighting.
 * Mentions are split first, then search highlights are applied to non-mention segments.
 */
export const HighlightText = memo(function HighlightText({ text }: { text: string }) {
  const query = useSearchHighlight()
  const { userHandles, kinHandles } = useMentionLookup()
  const hasMentionables = userHandles.size > 0 || kinHandles.size > 0

  const rendered = useMemo(() => {
    if (!hasMentionables) {
      // No mentionables loaded — fall back to search-only highlighting
      return applySearchHighlight(text, query)
    }

    // Step 1: split on @mention patterns
    const mentionRegex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
    const segments = text.split(mentionRegex)
    // split with capture group: [text, handle, text, handle, ...]

    const elements: React.ReactNode[] = []
    let mentionIndex = 0

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!
      if (i % 2 === 1) {
        // This is a captured handle (odd indices from the split with capture group)
        const handle = segment
        const lower = handle.toLowerCase()
        const isUser = userHandles.has(lower)
        const isKin = !isUser && kinHandles.has(lower)

        if (isUser || isKin) {
          elements.push(
            <span
              key={`mention-${mentionIndex++}`}
              className={
                isUser
                  ? 'mention-pill mention-user'
                  : 'mention-pill mention-kin'
              }
            >
              @{handle}
            </span>,
          )
        } else {
          // Unknown handle — render as plain text (with search highlight)
          elements.push(...applySearchHighlight(`@${handle}`, query, `unk-${mentionIndex++}`))
        }
      } else if (segment) {
        // Regular text segment — apply search highlighting
        elements.push(...applySearchHighlight(segment, query, `seg-${i}`))
      }
    }

    return elements
  }, [text, query, userHandles, kinHandles, hasMentionables])

  return <>{rendered}</>
})

/** Apply search query highlighting to a text segment. Returns an array of ReactNodes. */
function applySearchHighlight(text: string, query: string, keyPrefix = 'hl'): React.ReactNode[] {
  if (!query || query.trim().length < 2) {
    return [text]
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  if (parts.length <= 1) {
    return [text]
  }

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={`${keyPrefix}-${i}`}
        className="rounded-sm bg-yellow-300/80 text-inherit dark:bg-yellow-500/40 px-0.5"
      >
        {part}
      </mark>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  )
}
