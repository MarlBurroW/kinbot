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
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (successKey) toast.success(t(successKey))
      setTimeout(() => setCopied(false), resetMs)
    } catch {
      if (errorKey) toast.error(t(errorKey))
    }
  }, [t])

  return { copy, copied }
}
