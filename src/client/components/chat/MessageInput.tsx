import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { cn } from '@/client/lib/utils'
import { SendHorizontal, Square } from 'lucide-react'

interface MessageInputProps {
  onSend: (content: string) => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function MessageInput({ onSend, onStop, isStreaming = false, disabled, disabledReason }: MessageInputProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed)
    setContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t bg-background/80 backdrop-blur-sm p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabledReason ?? t('chat.placeholder')}
          disabled={disabled || isStreaming}
          rows={1}
          className={cn(
            'min-h-10 max-h-40 resize-none',
            disabledReason && 'placeholder:text-warning/70',
          )}
        />
        {isStreaming ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onStop}
                size="icon"
                variant="destructive"
                className="shrink-0"
              >
                <Square className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('chat.stop')}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={disabled || !content.trim()}
            size="icon"
            className="shrink-0"
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
