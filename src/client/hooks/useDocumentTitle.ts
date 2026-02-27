import { useEffect } from 'react'

const BASE_TITLE = 'KinBot'

/**
 * Update the browser tab title dynamically.
 *
 * Shows the selected Kin name, a typing indicator when processing,
 * and an unread message count badge when there are unseen messages
 * (e.g. when the tab was in the background).
 */
export function useDocumentTitle(
  kinName?: string | null,
  isProcessing?: boolean,
  unreadCount?: number,
) {
  useEffect(() => {
    if (!kinName) {
      document.title = unreadCount
        ? `(${unreadCount}) ${BASE_TITLE}`
        : BASE_TITLE
      return
    }

    const badge = unreadCount ? `(${unreadCount}) ` : ''

    document.title = isProcessing
      ? `${badge}✦ ${kinName} · ${BASE_TITLE}`
      : `${badge}${kinName} · ${BASE_TITLE}`

    return () => {
      document.title = BASE_TITLE
    }
  }, [kinName, isProcessing, unreadCount])
}
