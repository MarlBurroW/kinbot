import { useRef, useState, useCallback, forwardRef, useImperativeHandle, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { cn } from '@/client/lib/utils'
import { SendHorizontal, Square, Paperclip, X, FileIcon, Loader2 } from 'lucide-react'
import { useInputHistory } from '@/client/hooks/useInputHistory'
import { MAX_MESSAGE_LENGTH } from '@/shared/constants'
import { MentionPopover, getMentionItemCount, getMentionItemAt, type MentionItem } from '@/client/components/chat/MentionPopover'
import { CommandPopover, getFilteredCommands, SLASH_COMMANDS, type SlashCommand } from '@/client/components/chat/CommandPopover'
import { getCaretCoordinates } from '@/client/lib/getCaretCoordinates'
import type { MentionableUser, MentionableKin } from '@/client/hooks/useMentionables'
import type { PendingFile } from '@/client/hooks/useFileUpload'

export interface MessageInputHandle {
  focus: () => void
}

interface MessageInputProps {
  onSend: (content: string, fileIds?: string[]) => void
  onStop?: () => void
  isStreaming?: boolean
  /** Kin is processing (dequeued) but may not have started streaming tokens yet */
  isProcessing?: boolean
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
  /** Inject a message into the current streaming response (/btw) */
  onInject?: (content: string) => void
  /** Handle a slash command (name without /, optional arg) */
  onCommand?: (command: string, arg?: string) => void
  /** Kin ID for input history (Up/Down arrow to cycle through sent messages) */
  kinId?: string
  /** Users available for @mention autocomplete */
  mentionableUsers?: MentionableUser[]
  /** Kins available for @mention autocomplete */
  mentionableKins?: MentionableKin[]
}

export const MessageInput = memo(forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({
  onSend,
  onStop,
  isStreaming = false,
  isProcessing = false,
  disabled,
  disabledReason,
  value,
  onChange,
  pendingFiles,
  isUploading,
  onAddFiles,
  onRemoveFile,
  onInject,
  onCommand,
  kinId,
  mentionableUsers,
  mentionableKins,
}, ref) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStartIndex, setMentionStartIndex] = useState(0)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number }>({ top: 8, left: 0 })
  const isMentionOpen = mentionQuery !== null && (mentionableUsers?.length || mentionableKins?.length)

  // Slash command autocomplete state
  const [commandQuery, setCommandQuery] = useState<string | null>(null)
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0)
  const [commandPosition, setCommandPosition] = useState<{ top: number; left: number }>({ top: 8, left: 0 })
  const isCommandOpen = commandQuery !== null

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }))

  const history = useInputHistory(kinId ?? '__default__')

  /** Detect @mention trigger from the current cursor position */
  const detectMention = useCallback((text: string, cursorPos: number) => {
    // Walk backwards from cursor to find @ that starts this mention
    let i = cursorPos - 1
    while (i >= 0 && /[a-zA-Z0-9_-]/.test(text[i]!)) i--

    if (i >= 0 && text[i] === '@') {
      // Check that @ is at start of text or preceded by whitespace
      if (i === 0 || /\s/.test(text[i - 1]!)) {
        const query = text.slice(i + 1, cursorPos)
        setMentionQuery(query)
        setMentionStartIndex(i)
        setMentionSelectedIndex(0)
        // Compute popover position from caret
        const textarea = textareaRef.current
        if (textarea) {
          const coords = getCaretCoordinates(textarea, i)
          const textareaRect = textarea.getBoundingClientRect()
          // Position the popover above the caret line (bottom-anchored)
          const distanceFromBottom = textareaRect.height - coords.top - coords.height
          setMentionPosition({ top: Math.max(distanceFromBottom, 8), left: coords.left })
        }
        return
      }
    }

    setMentionQuery(null)
  }, [])

  /** Detect /command trigger: only when / is at position 0 and no space yet (typing the command name) */
  const detectCommand = useCallback((text: string, cursorPos: number) => {
    // Command must start at beginning of input with /
    if (text.startsWith('/')) {
      // Extract the part after / up to cursor or first space
      const afterSlash = text.slice(1, cursorPos)
      // Only show popover while typing the command name (no space yet)
      if (!afterSlash.includes(' ')) {
        setCommandQuery(afterSlash)
        setCommandSelectedIndex(0)
        // Position popover above the textarea
        const textarea = textareaRef.current
        if (textarea) {
          const coords = getCaretCoordinates(textarea, 0)
          const textareaRect = textarea.getBoundingClientRect()
          const distanceFromBottom = textareaRect.height - coords.top - coords.height
          setCommandPosition({ top: Math.max(distanceFromBottom, 8), left: coords.left })
        }
        return
      }
    }
    setCommandQuery(null)
  }, [])

  /** Handle change: update value and detect mention/command */
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue)
    // Use requestAnimationFrame to read cursor position after React updates the textarea
    requestAnimationFrame(() => {
      const cursor = textareaRef.current?.selectionStart ?? newValue.length
      detectMention(newValue, cursor)
      detectCommand(newValue, cursor)
    })
  }, [onChange, detectMention, detectCommand])

  /** Insert selected mention into the text */
  const handleMentionSelect = useCallback((item: MentionItem) => {
    const before = value.slice(0, mentionStartIndex)
    const after = value.slice(mentionStartIndex + 1 + (mentionQuery?.length ?? 0)) // +1 for the @
    const newValue = `${before}@${item.handle} ${after}`
    onChange(newValue)
    setMentionQuery(null)

    // Place cursor right after the inserted mention
    const cursorPos = mentionStartIndex + 1 + item.handle.length + 1
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(cursorPos, cursorPos)
      textareaRef.current?.focus()
    })
  }, [value, onChange, mentionStartIndex, mentionQuery])

  /** Handle selecting a slash command from the popover */
  const handleCommandSelect = useCallback((cmd: SlashCommand) => {
    if (cmd.hasArg) {
      // Commands with args: insert "/name " and let user type the argument
      const newValue = `/${cmd.name} `
      onChange(newValue)
      setCommandQuery(null)
      requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(newValue.length, newValue.length)
        textareaRef.current?.focus()
      })
    } else {
      // Commands without args: execute immediately
      onChange('')
      setCommandQuery(null)
      onCommand?.(cmd.name)
    }
  }, [onChange, onCommand])

  const hasPendingFiles = pendingFiles && pendingFiles.length > 0
  const readyFileIds = pendingFiles?.filter((f) => f.status === 'done').map((f) => f.serverId!)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if ((!trimmed && !hasPendingFiles) || disabled || isUploading || trimmed.length > MAX_MESSAGE_LENGTH) return

    // Handle slash commands
    const cmdMatch = trimmed.match(/^\/(\S+)(?:\s+(.+))?$/s)
    if (cmdMatch) {
      const cmdName = cmdMatch[1]!.toLowerCase()
      const cmdArg = cmdMatch[2]?.trim()

      // /btw: inject into current streaming response
      if (cmdName === 'btw' && cmdArg && (isStreaming || isProcessing) && onInject) {
        onInject(cmdArg)
        onChange('')
        return
      }

      // All other known commands: delegate to onCommand
      const knownCommands = SLASH_COMMANDS.map((c) => c.name)
      if (knownCommands.includes(cmdName) && onCommand) {
        onCommand(cmdName, cmdArg)
        onChange('')
        return
      }
    }

    history.push(trimmed)
    onSend(trimmed, readyFileIds?.length ? readyFileIds : undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Command popover keyboard navigation
    if (isCommandOpen) {
      const cmds = getFilteredCommands(commandQuery!, isStreaming)
      if (cmds.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setCommandSelectedIndex((prev) => (prev + 1) % cmds.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setCommandSelectedIndex((prev) => (prev - 1 + cmds.length) % cmds.length)
          return
        }
        if (e.key === 'Tab') {
          e.preventDefault()
          const cmd = cmds[commandSelectedIndex]
          if (cmd) handleCommandSelect(cmd)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setCommandQuery(null)
        return
      }
    }

    // Mention popover keyboard navigation
    if (isMentionOpen && mentionableUsers && mentionableKins) {
      const count = getMentionItemCount(mentionQuery!, mentionableUsers, mentionableKins)
      if (count > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionSelectedIndex((prev) => (prev + 1) % count)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionSelectedIndex((prev) => (prev - 1 + count) % count)
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          const item = getMentionItemAt(mentionSelectedIndex, mentionQuery!, mentionableUsers, mentionableKins)
          if (item) handleMentionSelect(item)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    // Input history navigation: Up/Down arrows when cursor is at position 0 (start of input)
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const textarea = e.currentTarget
      const cursorAtStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0
      // Only navigate history when cursor is at position 0 (for Up) or input came from history (for Down)
      if (e.key === 'ArrowUp' && cursorAtStart) {
        const prev = history.navigate('up', value)
        if (prev !== null) {
          e.preventDefault()
          onChange(prev)
        }
      } else if (e.key === 'ArrowDown') {
        const next = history.navigate('down', value)
        if (next !== null) {
          e.preventDefault()
          onChange(next)
        }
      }
    }

    // Escape resets history browsing
    if (e.key === 'Escape') {
      history.reset()
    }

    // Formatting shortcuts
    const mod = e.ctrlKey || e.metaKey
    if (mod && !e.altKey) {
      if (e.key === 'b') { e.preventDefault(); e.stopPropagation(); wrapSelection('**', '**') }
      else if (e.key === 'i') { e.preventDefault(); e.stopPropagation(); wrapSelection('_', '_') }
      else if (e.key === 'e' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); wrapSelection('```\n', '\n```') }
      else if (e.key === 'e') { e.preventDefault(); e.stopPropagation(); wrapSelection('`', '`') }
      else if (e.key === 'x' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); wrapSelection('~~', '~~') }
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

  /** Wrap the current selection (or insert at cursor) with markdown syntax */
  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selected = value.slice(start, end)

      const newValue =
        value.slice(0, start) + prefix + selected + suffix + value.slice(end)
      onChange(newValue)

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        if (selected) {
          // Select the wrapped text
          textarea.setSelectionRange(start + prefix.length, end + prefix.length)
        } else {
          // Place cursor between prefix and suffix
          textarea.setSelectionRange(start + prefix.length, start + prefix.length)
        }
        textarea.focus()
      })
    },
    [value, onChange],
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
                    disabled={disabled}
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

          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={disabledReason ?? t('chat.placeholder')}
              disabled={disabled}
              rows={1}
              className={cn(
                'min-h-10 max-h-40 resize-none',
                disabledReason && 'placeholder:text-warning/70',
              )}
            />

            {/* @mention autocomplete popover */}
            {isMentionOpen && mentionableUsers && mentionableKins && (
              <MentionPopover
                query={mentionQuery!}
                users={mentionableUsers}
                kins={mentionableKins}
                selectedIndex={mentionSelectedIndex}
                position={mentionPosition}
                onSelect={handleMentionSelect}
              />
            )}

            {/* /command autocomplete popover */}
            {isCommandOpen && !isMentionOpen && (
              <CommandPopover
                query={commandQuery!}
                selectedIndex={commandSelectedIndex}
                position={commandPosition}
                isStreaming={isStreaming}
                onSelect={handleCommandSelect}
              />
            )}
          </div>

          {(isStreaming || isProcessing) && (
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
          )}
          <Button
            onClick={handleSubmit}
            disabled={disabled || isUploading || (!value.trim() && !hasPendingFiles) || value.length > MAX_MESSAGE_LENGTH}
            size="icon"
            className="shrink-0"
          >
            <SendHorizontal className="size-4" />
          </Button>
        </div>

        {/* Character count — always rendered to avoid layout shift */}
        <div className="mt-1 flex justify-end px-1">
          <span className={cn(
            'text-[10px] tabular-nums transition-opacity duration-150',
            value.length > 0 ? 'opacity-100' : 'opacity-0',
            value.length > MAX_MESSAGE_LENGTH
              ? 'text-destructive font-medium'
              : value.length > MAX_MESSAGE_LENGTH * 0.75
                ? 'text-destructive'
                : value.length > MAX_MESSAGE_LENGTH * 0.5
                  ? 'text-warning'
                  : 'text-muted-foreground/50',
          )}>
            {value.length > MAX_MESSAGE_LENGTH
              ? t('chat.messageTooLong', { count: value.length, max: MAX_MESSAGE_LENGTH })
              : value.length > 0
                ? t('chat.charCount', { count: value.length })
                : '\u00A0'}
          </span>
        </div>
      </div>
    </div>
  )
}))
