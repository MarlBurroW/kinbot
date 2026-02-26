import { useEffect } from 'react'

const BASE_TITLE = 'KinBot'

/**
 * Update the browser tab title dynamically.
 *
 * Shows the selected Kin name and a typing indicator when processing,
 * so users with multiple tabs can quickly identify which Kin is active.
 */
export function useDocumentTitle(
  kinName?: string | null,
  isProcessing?: boolean,
) {
  useEffect(() => {
    if (!kinName) {
      document.title = BASE_TITLE
      return
    }

    document.title = isProcessing
      ? `✦ ${kinName} · ${BASE_TITLE}`
      : `${kinName} · ${BASE_TITLE}`

    return () => {
      document.title = BASE_TITLE
    }
  }, [kinName, isProcessing])
}
