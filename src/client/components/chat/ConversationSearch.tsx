import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/client/lib/utils'

interface ConversationSearchProps {
  onClose: () => void
  onSearchChange: (query: string, matchIndex: number, matchCount: number) => void
  messages: Array<{ id: string; content: string }>
}

export function ConversationSearch({ onClose, onSearchChange, messages }: ConversationSearchProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Compute matches
  const matches = query.trim().length >= 2
    ? messages
        .map((msg, i) => ({ msgIndex: i, msgId: msg.id }))
        .filter(({ msgIndex }) =>
          messages[msgIndex]!.content.toLowerCase().includes(query.toLowerCase()),
        )
    : []

  const matchCount = matches.length

  // Notify parent of search state changes
  useEffect(() => {
    onSearchChange(query, currentIndex, matchCount)
  }, [query, currentIndex, matchCount, onSearchChange])

  // Reset index when query or matches change
  useEffect(() => {
    setCurrentIndex(0)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && matchCount > 0) {
        if (e.shiftKey) {
          setCurrentIndex((prev) => (prev - 1 + matchCount) % matchCount)
        } else {
          setCurrentIndex((prev) => (prev + 1) % matchCount)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [matchCount, onClose])

  // Scroll to current match
  useEffect(() => {
    if (matchCount === 0 || !matches[currentIndex]) return
    const msgId = matches[currentIndex].msgId
    // Find the message element in the DOM and scroll to it
    const el = document.querySelector(`[data-message-id="${msgId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex, matchCount, matches])

  const goUp = useCallback(() => {
    if (matchCount > 0) setCurrentIndex((prev) => (prev - 1 + matchCount) % matchCount)
  }, [matchCount])

  const goDown = useCallback(() => {
    if (matchCount > 0) setCurrentIndex((prev) => (prev + 1) % matchCount)
  }, [matchCount])

  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2 animate-fade-in">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('chat.search.placeholder')}
        className="h-7 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
      />
      {query.trim().length >= 2 && (
        <span className={cn(
          'shrink-0 text-xs tabular-nums',
          matchCount === 0 ? 'text-destructive' : 'text-muted-foreground',
        )}>
          {matchCount === 0
            ? t('chat.search.noResults')
            : t('chat.search.results', { current: currentIndex + 1, total: matchCount })}
        </span>
      )}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goUp}
          disabled={matchCount === 0}
          className="size-6"
          title={t('chat.search.previous')}
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goDown}
          disabled={matchCount === 0}
          className="size-6"
          title={t('chat.search.next')}
        >
          <ChevronDown className="size-3.5" />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        className="size-6"
        title={t('chat.search.close')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
