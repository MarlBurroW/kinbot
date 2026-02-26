import { useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { cn } from '@/client/lib/utils'
import { SendHorizontal, Square, Paperclip, X, FileIcon, Loader2 } from 'lucide-react'
import type { PendingFile } from '@/client/hooks/useFileUpload'

interface MessageInputProps {
  onSend: (content: string, fileIds?: string[]) => void
  onStop?: () => void
  isStreaming?: boolean
  disabled?: boolean
  disabledReason?: string
  /** Controlled text value */
  value: string
  /** Controlled text change handler */
  onChange: (value: string) => void
  /** Pending file attachments */
  pendingFiles?: PendingFile[]
  /** Whether any file is currently uploading */
  isUploading?: boolean
  /** Add files to the pending list */
  onAddFiles?: (files: FileList | File[]) => void
  /** Remove a pending file */
  onRemoveFile?: (localId: string) => void
}

export function MessageInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled,
  disabledReason,
  value,
  onChange,
  pendingFiles,
  isUploading,
  onAddFiles,
  onRemoveFile,
}: MessageInputProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const hasPendingFiles = pendingFiles && pendingFiles.length > 0
  const readyFileIds = pendingFiles?.filter((f) => f.status === 'done').map((f) => f.serverId!)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if ((!trimmed && !hasPendingFiles) || disabled || isStreaming || isUploading) return
    onSend(trimmed, readyFileIds?.length ? readyFileIds : undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0 && onAddFiles) {
        onAddFiles(e.target.files)
      }
      // Reset so the same file can be re-selected
      e.target.value = ''
    },
    [onAddFiles],
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragging(false)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onAddFiles) {
        onAddFiles(e.dataTransfer.files)
      }
    },
    [onAddFiles],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!onAddFiles) return
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        onAddFiles(files)
      }
    },
    [onAddFiles],
  )

  return (
    <div
      className="relative border-t bg-background/80 backdrop-blur-sm p-4"
      onDragEnter={onAddFiles ? handleDragEnter : undefined}
      onDragLeave={onAddFiles ? handleDragLeave : undefined}
      onDragOver={onAddFiles ? handleDragOver : undefined}
      onDrop={onAddFiles ? handleDrop : undefined}
    >
      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10">
          <p className="text-sm font-medium text-primary">{t('chat.dropFiles')}</p>
        </div>
      )}

      <div className="mx-auto max-w-3xl">
        {/* Pending file chips */}
        {hasPendingFiles && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((pf) => (
              <div
                key={pf.localId}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs',
                  pf.status === 'error'
                    ? 'border-destructive/50 bg-destructive/10 text-destructive'
                    : 'border-border bg-muted/50 text-muted-foreground',
                )}
              >
                {/* Thumbnail or icon */}
                {pf.previewUrl ? (
                  <img
                    src={pf.previewUrl}
                    alt={pf.name}
                    className="size-8 rounded object-cover"
                  />
                ) : (
                  <FileIcon className="size-4 shrink-0" />
                )}

                <span className="max-w-28 truncate">{pf.name}</span>

                {pf.status === 'uploading' && (
                  <Loader2 className="size-3 shrink-0 animate-spin" />
                )}

                {onRemoveFile && (
                  <button
                    type="button"
                    onClick={() => onRemoveFile(pf.localId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                    aria-label={t('chat.removeFile')}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Attach button */}
          {onAddFiles && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    disabled={disabled || isStreaming}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('chat.attachFile')}</TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </>
          )}

          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
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
              disabled={disabled || isUploading || (!value.trim() && !hasPendingFiles)}
              size="icon"
              className="shrink-0"
            >
              <SendHorizontal className="size-4" />
            </Button>
          )}
        </div>

        {/* Character count */}
        {value.length > 0 && (
          <div className="mt-1 flex justify-end px-1">
            <span className={cn(
              'text-[10px] tabular-nums transition-colors',
              value.length > 4000
                ? 'text-destructive'
                : value.length > 2000
                  ? 'text-warning'
                  : 'text-muted-foreground/50',
            )}>
              {t('chat.charCount', { count: value.length })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
