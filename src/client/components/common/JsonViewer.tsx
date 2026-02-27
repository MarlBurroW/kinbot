import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'

interface JsonViewerProps {
  data: unknown
  label?: string
  labelClassName?: string
  maxHeight?: string
  className?: string
}

/**
 * Syntax-highlighted JSON token types.
 * We render each token as a <span> with a specific class.
 */
type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation'

interface Token {
  type: TokenType
  value: string
}

const TOKEN_CLASSES: Record<TokenType, string> = {
  key: 'text-foreground font-medium',
  string: 'text-chart-2',
  number: 'text-chart-1',
  boolean: 'text-info',
  null: 'text-muted-foreground italic',
  punctuation: 'text-muted-foreground',
}

/**
 * Tokenize a beautified JSON string into typed tokens for syntax highlighting.
 * Much lighter than pulling in highlight.js for just JSON.
 */
function tokenizeJson(json: string): Token[] {
  const tokens: Token[] = []
  // Regex matches JSON tokens: strings, numbers, booleans, null, and structural chars
  const re = /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(true|false)\b|(null)\b|([{}[\]:,])/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(json)) !== null) {
    // Whitespace between tokens
    if (match.index > lastIndex) {
      tokens.push({ type: 'punctuation', value: json.slice(lastIndex, match.index) })
    }

    if (match[1] !== undefined) {
      // Key (string followed by colon)
      tokens.push({ type: 'key', value: match[1] })
      // The colon and whitespace
      const colonStart = match.index + match[1].length
      const colonEnd = match.index + match[0].length
      if (colonEnd > colonStart) {
        tokens.push({ type: 'punctuation', value: json.slice(colonStart, colonEnd) })
      }
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'string', value: match[2] })
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'number', value: match[3] })
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'boolean', value: match[4] })
    } else if (match[5] !== undefined) {
      tokens.push({ type: 'null', value: match[5] })
    } else if (match[6] !== undefined) {
      tokens.push({ type: 'punctuation', value: match[6] })
    }

    lastIndex = match.index + match[0].length
  }

  // Trailing whitespace
  if (lastIndex < json.length) {
    tokens.push({ type: 'punctuation', value: json.slice(lastIndex) })
  }

  return tokens
}

/** Compact JSON viewer with syntax highlighting and copy button. */
export function JsonViewer({ data, label, labelClassName, maxHeight = 'max-h-60', className }: JsonViewerProps) {
  const { t } = useTranslation()
  const { copy, copied } = useCopyToClipboard()

  const beautified = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }, [data])

  const tokens = useMemo(() => tokenizeJson(beautified), [beautified])

  const handleCopy = useCallback(() => {
    copy(beautified, { successKey: '', resetMs: 1500 })
  }, [beautified, copy])

  return (
    <div className={cn('rounded-md bg-background/60 group/json', className)}>
      {/* Header with label + copy button */}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
        {label && (
          <p className={cn('text-[10px] font-medium text-muted-foreground', labelClassName)}>
            {label}
          </p>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 group-hover/json:opacity-100 hover:bg-muted transition-all"
          title={t('common.copy', { defaultValue: 'Copy' })}
        >
          {copied ? (
            <>
              <Check className="size-3 text-success" />
              <span className="text-success">{t('common.copied', { defaultValue: 'Copied' })}</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>{t('common.copy', { defaultValue: 'Copy' })}</span>
            </>
          )}
        </button>
      </div>

      {/* Syntax-highlighted JSON */}
      <pre className={cn(
        'px-2 pb-2 text-xs leading-relaxed overflow-auto whitespace-pre-wrap break-all',
        'font-mono',
        maxHeight,
      )}>
        {tokens.map((token, i) => (
          <span key={i} className={TOKEN_CLASSES[token.type]}>
            {token.value}
          </span>
        ))}
      </pre>
    </div>
  )
}
