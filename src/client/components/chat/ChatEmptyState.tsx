import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Sparkles, MessageSquare, Lightbulb, Wrench } from 'lucide-react'

interface ChatEmptyStateProps {
  kinName: string
  kinRole: string
  kinAvatarUrl: string | null
  onSendMessage: (content: string) => void
}

const SUGGESTION_ICONS = [Sparkles, MessageSquare, Lightbulb, Wrench] as const

export const ChatEmptyState = memo(function ChatEmptyState({ kinName, kinRole, kinAvatarUrl, onSendMessage }: ChatEmptyStateProps) {
  const { t } = useTranslation()

  const initials = kinName.slice(0, 2).toUpperCase()

  // Get suggestion chips from i18n (returns array of strings)
  const suggestions = t('chat.emptyState.suggestions', { returnObjects: true, defaultValue: [] })
  const suggestionList = Array.isArray(suggestions) ? suggestions.slice(0, 4) : []

  const handleSuggestionClick = useCallback((text: string) => {
    onSendMessage(text)
  }, [onSendMessage])

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      {/* Kin avatar */}
      <Avatar className="size-16 mb-4 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
        {kinAvatarUrl ? (
          <AvatarImage src={kinAvatarUrl} alt={kinName} />
        ) : (
          <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
        )}
      </Avatar>

      {/* Greeting */}
      <h2 className="text-lg font-semibold">
        {t('chat.emptyState.greeting', { name: kinName })}
      </h2>
      <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {kinRole || t('chat.emptyState.defaultRole')}
      </p>

      {/* Suggestion chips */}
      {suggestionList.length > 0 && (
        <div className="mt-8 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
          {suggestionList.map((suggestion, i) => {
            const Icon = SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]!
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSuggestionClick(suggestion as string)}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 text-left text-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary/60" />
                <span className="text-muted-foreground leading-snug">{suggestion as string}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Hint */}
      <p className="mt-6 text-xs text-muted-foreground/60">
        {t('chat.emptyState.hint')}
      </p>
    </div>
  )
})
