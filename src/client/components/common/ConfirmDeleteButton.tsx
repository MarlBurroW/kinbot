import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

interface ConfirmDeleteButtonProps {
  onConfirm: () => void
  title?: string
  description: string
  /** Custom confirm button label (defaults to common.delete) */
  confirmLabel?: string
  /** Button variant, defaults to "ghost" */
  variant?: 'ghost' | 'destructive'
  /** Button size, defaults to "icon-xs" */
  size?: 'icon-xs' | 'icon' | 'sm'
  /** Icon size class, defaults to "size-3.5" */
  iconSize?: string
  /** Extra class on the trigger button */
  className?: string
  /** Render a custom trigger element instead of the default Button */
  trigger?: React.ReactNode
}

export function ConfirmDeleteButton({
  onConfirm,
  title,
  description,
  confirmLabel,
  variant = 'ghost',
  size = 'icon-xs',
  iconSize = 'size-3.5',
  className,
  trigger,
}: ConfirmDeleteButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          {trigger}
        </span>
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label={t('common.delete')}
          onClick={(e) => {
            e.stopPropagation()
            setOpen(true)
          }}
        >
          <Trash2 className={iconSize} />
        </Button>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('common.delete')}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel ?? t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
