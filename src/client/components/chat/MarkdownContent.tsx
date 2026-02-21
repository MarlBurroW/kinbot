import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { cn } from '@/client/lib/utils'

interface MarkdownContentProps {
  content: string
  /** Whether the content lives inside a user bubble (primary bg) */
  isUser?: boolean
  className?: string
}

const remarkPlugins = [remarkGfm, remarkMath]
const rehypePlugins = [rehypeHighlight, rehypeKatex]

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
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  )
})
