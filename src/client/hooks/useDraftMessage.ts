import { useState, useEffect, useCallback } from 'react'

/** Module-level map — survives component unmounts, resets on full page reload */
const drafts = new Map<string, string>()

/**
 * Persists draft message content per Kin across component unmounts.
 * Switching Kins restores the previously typed draft.
 */
export function useDraftMessage(kinId: string | null) {
  const [content, setContentState] = useState(() =>
    kinId ? (drafts.get(kinId) ?? '') : '',
  )

  // Sync from map when kinId changes
  useEffect(() => {
    setContentState(kinId ? (drafts.get(kinId) ?? '') : '')
  }, [kinId])

  const setContent = useCallback(
    (value: string) => {
      if (kinId) drafts.set(kinId, value)
      setContentState(value)
    },
    [kinId],
  )

  const clearDraft = useCallback(() => {
    if (kinId) drafts.delete(kinId)
    setContentState('')
  }, [kinId])

  return { content, setContent, clearDraft }
}
