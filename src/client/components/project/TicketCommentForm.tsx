import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import { getErrorMessage } from '@/client/lib/api'
import { toast } from 'sonner'

interface TicketCommentFormProps {
  onSubmit: (content: string) => Promise<unknown>
  disabled?: boolean
}

export function TicketCommentForm({ onSubmit, disabled }: TicketCommentFormProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setValue('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('projects.ticket.comments.placeholder')}
        rows={3}
        disabled={disabled || submitting}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void handleSubmit()
          }
        }}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || submitting || value.trim().length === 0}
        >
          {submitting ? t('projects.ticket.comments.submitting') : t('projects.ticket.comments.submit')}
        </Button>
      </div>
    </div>
  )
}
