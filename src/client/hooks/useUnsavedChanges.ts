import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Hook to track unsaved changes in a dialog/form and intercept close attempts.
 *
 * Usage:
 * ```tsx
 * const { isDirty, markDirty, resetDirty, guardedClose, confirmDialogProps } = useUnsavedChanges({
 *   onClose: () => onOpenChange(false),
 * })
 *
 * // Wrap onOpenChange to intercept close:
 * <Dialog open={open} onOpenChange={(v) => { if (!v) guardedClose(); else onOpenChange(true) }}>
 *
 * // Render the confirm dialog:
 * <UnsavedChangesDialog {...confirmDialogProps} />
 * ```
 */

interface UseUnsavedChangesOptions {
  onClose: () => void
}

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

interface UseUnsavedChangesReturn {
  /** Whether there are unsaved changes */
  isDirty: boolean
  /** Mark the form as dirty (call on any field change) */
  markDirty: () => void
  /** Reset dirty state (call after save or when re-initializing) */
  resetDirty: () => void
  /** Call this instead of directly closing — shows confirm if dirty */
  guardedClose: () => void
  /** Props for the UnsavedChangesDialog */
  confirmDialogProps: ConfirmDialogProps
}

export function useUnsavedChanges({ onClose }: UseUnsavedChangesOptions): UseUnsavedChangesReturn {
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const markDirty = useCallback(() => setIsDirty(true), [])
  const resetDirty = useCallback(() => {
    setIsDirty(false)
    setShowConfirm(false)
  }, [])

  const guardedClose = useCallback(() => {
    if (isDirty) {
      setShowConfirm(true)
    } else {
      onClose()
    }
  }, [isDirty, onClose])

  const handleConfirm = useCallback(() => {
    setShowConfirm(false)
    setIsDirty(false)
    onClose()
  }, [onClose])

  const handleCancel = useCallback(() => {
    setShowConfirm(false)
  }, [])

  return {
    isDirty,
    markDirty,
    resetDirty,
    guardedClose,
    confirmDialogProps: {
      open: showConfirm,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  }
}
