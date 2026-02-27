import { memo, useMemo } from 'react'
import { useSearchHighlight } from '@/client/components/chat/SearchHighlightContext'

/**
 * Wraps matching substrings in <mark> elements for search highlighting.
 * Uses the search query from SearchHighlightContext.
 */
export const HighlightText = memo(function HighlightText({ text }: { text: string }) {
  const query = useSearchHighlight()

  const parts = useMemo(() => {
    if (!query || query.trim().length < 2) return null

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const segments = text.split(regex)

    if (segments.length <= 1) return null

    return segments.map((segment, i) =>
      regex.test(segment) ? (
        <mark
          key={i}
          className="rounded-sm bg-yellow-300/80 text-inherit dark:bg-yellow-500/40 px-0.5"
        >
          {segment}
        </mark>
      ) : (
        <span key={i}>{segment}</span>
      ),
    )
  }, [text, query])

  if (!parts) return <>{text}</>
  return <>{parts}</>
})
