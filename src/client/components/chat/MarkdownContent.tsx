import { memo, useCallback, useMemo, useState, type HTMLAttributes } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { useTranslation } from 'react-i18next'
import { Copy, Check, WrapText, Download } from 'lucide-react'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import { cn } from '@/client/lib/utils'
import { HighlightText } from '@/client/components/chat/HighlightText'

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
  const { copy, copied } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copy(code, { successKey: 'chat.codeBlock.copied', errorKey: 'chat.codeBlock.copyFailed' })
  }, [code, copy])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'rounded-md p-1.5 transition-all',
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
    return extractTextContent((node as React.ReactElement<{ children?: React.ReactNode }>).props.children)
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

/** Map language identifiers to file extensions for downloading. */
const LANG_EXTENSION: Record<string, string> = {
  js: 'js', javascript: 'js', jsx: 'jsx',
  ts: 'ts', typescript: 'ts', tsx: 'tsx',
  py: 'py', python: 'py',
  rb: 'rb', ruby: 'rb',
  rs: 'rs', rust: 'rs',
  go: 'go', golang: 'go',
  sh: 'sh', bash: 'sh', zsh: 'zsh', fish: 'fish',
  json: 'json', yaml: 'yaml', yml: 'yml', toml: 'toml', xml: 'xml',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  sql: 'sql', graphql: 'graphql',
  md: 'md', markdown: 'md',
  dockerfile: 'Dockerfile', docker: 'Dockerfile',
  cpp: 'cpp', c: 'c', cs: 'cs', csharp: 'cs',
  java: 'java', kotlin: 'kt', swift: 'swift',
  php: 'php', lua: 'lua', perl: 'pl', r: 'r',
  diff: 'diff', plaintext: 'txt', text: 'txt',
  ini: 'ini', nginx: 'conf', makefile: 'Makefile',
}

function langExtension(lang: string | null): string {
  if (!lang) return 'txt'
  return LANG_EXTENSION[lang.toLowerCase()] ?? 'txt'
}

function CodeBlockDownloadButton({ code, language }: { code: string; language: string | null }) {
  const { t } = useTranslation()

  const handleDownload = useCallback(() => {
    const ext = langExtension(language)
    const filename = `code.${ext}`
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [code, language])

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={cn(
        'rounded-md p-1.5 transition-all',
        'bg-background/60 hover:bg-background/90 backdrop-blur-sm',
        'text-muted-foreground hover:text-foreground',
        'active:scale-95',
      )}
      title={t('chat.codeBlock.download')}
      aria-label={t('chat.codeBlock.download')}
    >
      <Download className="size-3.5" />
    </button>
  )
}

/** Minimum number of lines before showing line numbers. */
const LINE_NUMBER_THRESHOLD = 4

/** Minimum longest-line length before showing the wrap toggle. */
const WRAP_TOGGLE_THRESHOLD = 80

function CodeBlockWrapButton({ wrapped, onToggle }: { wrapped: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'rounded-md p-1.5 transition-all',
        'bg-background/60 hover:bg-background/90 backdrop-blur-sm',
        wrapped ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        'active:scale-95',
      )}
      title={wrapped ? t('chat.codeBlock.unwrap') : t('chat.codeBlock.wrap')}
      aria-label={wrapped ? t('chat.codeBlock.unwrap') : t('chat.codeBlock.wrap')}
    >
      <WrapText className="size-3.5" />
    </button>
  )
}

function PreBlock({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const code = extractTextContent(children).replace(/\n$/, '')
  const language = extractLanguage(children)
  const lines = code.split('\n')
  const showLineNumbers = lines.length >= LINE_NUMBER_THRESHOLD
  const longestLine = Math.max(...lines.map((l) => l.length))
  const showWrapToggle = longestLine >= WRAP_TOGGLE_THRESHOLD
  const [wrapped, setWrapped] = useState(false)

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
        {showLineNumbers && !wrapped && (
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
          className={cn(
            props.className,
            showLineNumbers && !wrapped && 'code-with-line-numbers',
            wrapped && 'code-wrapped',
          )}
        >
          {children}
        </pre>
      </div>
      {/* Floating toolbar — appears on hover */}
      {code && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/codeblock:opacity-100 transition-opacity">
          {showWrapToggle && <CodeBlockWrapButton wrapped={wrapped} onToggle={() => setWrapped((w) => !w)} />}
          <CodeBlockDownloadButton code={code} language={language} />
          <CodeBlockCopyButton code={code} />
        </div>
      )}
    </div>
  )
}

// Recursively walk React children and wrap string nodes with HighlightText
function highlightChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return <HighlightText text={children} />
  if (typeof children === 'number') return <HighlightText text={String(children)} />
  if (Array.isArray(children)) return children.map((child, i) => {
    if (typeof child === 'string') return <HighlightText key={i} text={child} />
    return child
  })
  return children
}

/** HOC that wraps an HTML element to apply search highlighting to its text children. */
function withHighlight(Tag: string) {
  return function HighlightedElement({ children, ...props }: HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    return <Tag {...props}>{highlightChildren(children)}</Tag>
  }
}

const markdownComponents = {
  pre: PreBlock,
  p: withHighlight('p'),
  li: withHighlight('li'),
  td: withHighlight('td'),
  th: withHighlight('th'),
  strong: withHighlight('strong'),
  em: withHighlight('em'),
  del: withHighlight('del'),
  a: withHighlight('a'),
  h1: withHighlight('h1'),
  h2: withHighlight('h2'),
  h3: withHighlight('h3'),
  h4: withHighlight('h4'),
  h5: withHighlight('h5'),
  h6: withHighlight('h6'),
  blockquote: withHighlight('blockquote'),
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
        <HighlightText text={content} />
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
