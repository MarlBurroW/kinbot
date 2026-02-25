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
  /** Button variant, defaults to "ghost" */
  variant?: 'ghost' | 'destructive'
  /** Button size, defaults to "icon-xs" */
  size?: 'icon-xs' | 'icon' | 'sm'
  /** Icon size class, defaults to "size-3.5" */
  iconSize?: string
  /** Extra class on the trigger button */
  className?: string
}

export function ConfirmDeleteButton({
  onConfirm,
  title,
  description,
  variant = 'ghost',
  size = 'icon-xs',
  iconSize = 'size-3.5',
  className,
}: ConfirmDeleteButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Trash2 className={iconSize} />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t('common.delete')}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
