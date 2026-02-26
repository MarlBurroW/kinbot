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

/** Extract the language from the <code> child's className (hljs adds `language-xxx` or `hljs language-xxx`). */
function extractLanguage(children: React.ReactNode): string | null {
  if (!children) return null
  const child = Array.isArray(children) ? children[0] : children
  if (typeof child === 'object' && child !== null && 'props' in child) {
    const className: string = (child as React.ReactElement<{ className?: string }>).props.className ?? ''
    const match = className.match(/language-(\S+)/)
    if (match) {
      const lang = match[1]
      // Skip hljs's "undefined" or empty
      if (lang && lang !== 'undefined') return lang
    }
  }
  return null
}

/** Human-friendly display names for common languages. */
const LANG_DISPLAY: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX',
  ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python',
  rb: 'Ruby', ruby: 'Ruby',
  rs: 'Rust', rust: 'Rust',
  go: 'Go', golang: 'Go',
  sh: 'Shell', bash: 'Bash', zsh: 'Zsh', fish: 'Fish',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML',
  html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'LESS',
  sql: 'SQL', graphql: 'GraphQL',
  md: 'Markdown', markdown: 'Markdown',
  dockerfile: 'Dockerfile', docker: 'Docker',
  cpp: 'C++', c: 'C', cs: 'C#', csharp: 'C#',
  java: 'Java', kotlin: 'Kotlin', swift: 'Swift',
  php: 'PHP', lua: 'Lua', perl: 'Perl', r: 'R',
  diff: 'Diff', plaintext: 'Text', text: 'Text',
  ini: 'INI', nginx: 'Nginx', makefile: 'Makefile',
}

function langDisplayName(lang: string): string {
  return LANG_DISPLAY[lang.toLowerCase()] ?? lang.toUpperCase()
}

/** Minimum number of lines before showing line numbers. */
const LINE_NUMBER_THRESHOLD = 4

function PreBlock({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const code = extractTextContent(children).replace(/\n$/, '')
  const language = extractLanguage(children)
  const lines = code.split('\n')
  const showLineNumbers = lines.length >= LINE_NUMBER_THRESHOLD

  return (
    <div className="group/codeblock relative">
      {/* Language label */}
      {language && (
        <div className="flex items-center justify-between rounded-t-md border border-b-0 border-border bg-muted/60 px-3 py-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {langDisplayName(language)}
          </span>
        </div>
      )}
      <div className={cn('relative', language && '[&>pre]:rounded-t-none [&>pre]:mt-0')}>
        {showLineNumbers && (
          <div
            className="absolute left-0 top-0 bottom-0 flex flex-col items-end select-none pointer-events-none py-[0.75em] pr-2 pl-2 text-[0.85em] leading-[1.5] font-mono text-muted-foreground/30 border-r border-border/30"
            aria-hidden="true"
          >
            {lines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <pre
          {...props}
          className={cn(props.className, showLineNumbers && 'code-with-line-numbers')}
        >
          {children}
        </pre>
      </div>
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
