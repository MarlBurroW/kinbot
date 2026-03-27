import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

interface CopyOptions {
  /** i18n key for success toast (default: 'common.copied') */
  successKey?: string
  /** i18n key for error toast (default: 'common.copyFailed') */
  errorKey?: string
  /** ms to keep `copied` state true (default: 2000) */
  resetMs?: number
}

/**
 * Legacy clipboard fallback using a temporary textarea and execCommand.
 * Used when the Clipboard API is unavailable (non-secure contexts like HTTP).
 */
function fallbackCopyToClipboard(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  // Prevent scrolling to bottom on iOS
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    const ok = document.execCommand('copy')
    if (!ok) throw new Error('execCommand copy returned false')
  } finally {
    document.body.removeChild(textarea)
  }
}

/**
 * Hook that provides a clipboard copy function with toast feedback and a `copied` state.
 *
 * Usage:
 *   const { copy, copied } = useCopyToClipboard()
 *   <Button onClick={() => copy(text, { successKey: 'chat.copied' })}>
 */
export function useCopyToClipboard() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string, options?: CopyOptions) => {
    const {
      successKey = 'common.copied',
      errorKey = 'common.copyFailed',
      resetMs = 2000,
    } = options ?? {}

    try {
      // Try the modern Clipboard API first (requires secure context: HTTPS or localhost)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts (e.g. HTTP access on Synology DSM)
        fallbackCopyToClipboard(text)
      }
      setCopied(true)
      if (successKey) toast.success(t(successKey))
      setTimeout(() => setCopied(false), resetMs)
    } catch {
      // If the modern API throws (e.g. permission denied), try the fallback
      try {
        fallbackCopyToClipboard(text)
        setCopied(true)
        if (successKey) toast.success(t(successKey))
        setTimeout(() => setCopied(false), resetMs)
      } catch {
        if (errorKey) toast.error(t(errorKey))
      }
    }
  }, [t])

  return { copy, copied }
}
