import { memo, useCallback, useMemo, useState, type HTMLAttributes } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/client/lib/utils'

interface MarkdownContentProps {
  content: string
  /** Whether the content lives inside a user bubble (primary bg) */
  isUser?: boolean
  className?: string
}

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeHighlight, rehypeKatex]

// ─── Code block with copy button ──────────────────────────────────────────────

function CodeBlockCopyButton({ code }: { code: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t('chat.codeBlock.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('chat.codeBlock.copyFailed'))
    }
  }, [code, t])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'absolute top-2 right-2 rounded-md p-1.5 transition-all',
        'opacity-0 group-hover/codeblock:opacity-100',
        'bg-background/60 hover:bg-background/90 backdrop-blur-sm',
        'text-muted-foreground hover:text-foreground',
        'active:scale-95',
      )}
      title={t('chat.codeBlock.copy')}
      aria-label={t('chat.codeBlock.copy')}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(extractTextContent).join('')
  if (typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as React.ReactElement).props.children)
  }
  return ''
}

function PreBlock({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const code = extractTextContent(children).replace(/\n$/, '')

  return (
    <div className="group/codeblock relative">
      <pre {...props}>{children}</pre>
      {code && <CodeBlockCopyButton code={code} />}
    </div>
  )
}

const markdownComponents = {
  pre: PreBlock,
}

// ─── Main component ───────────────────────────────────────────────────────────

export const MarkdownContent = memo(function MarkdownContent({
  content,
  isUser = false,
  className,
}: MarkdownContentProps) {
  // Skip markdown rendering for very short / plain messages
  const isPlainText = useMemo(() => {
    // No markdown markers at all → render as-is
    return !/[*_`#\[!\-|>~$\\]|\d+\./.test(content)
  }, [content])

  if (isPlainText) {
    return (
      <div className={cn('text-sm whitespace-pre-wrap break-words leading-relaxed', className)}>
        {content}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'markdown-content text-sm leading-relaxed',
        isUser && 'markdown-content--user',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
