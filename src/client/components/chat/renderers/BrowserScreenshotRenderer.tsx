import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Camera, Maximize2 } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import { ImageLightbox } from '@/client/components/chat/ImageLightbox'
import type { ToolResultRendererProps } from '@/client/lib/tool-renderers'

/**
 * Renders tool results that contain a screenshot file URL: browser_screenshot,
 * screenshot_url, and browser_request_human. Displays the image as a clickable
 * thumbnail with click-to-zoom via the existing ImageLightbox.
 */
export function BrowserScreenshotRenderer({ args, result, status }: ToolResultRendererProps) {
  const { t } = useTranslation()
  const [showRaw, setShowRaw] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const res = result as Record<string, unknown> | null | undefined
  const fileUrl = (typeof res?.fileUrl === 'string' ? res.fileUrl : null)
    ?? (typeof res?.screenshot_url === 'string' ? res.screenshot_url : null)
  const pageUrl = typeof res?.url === 'string' ? res.url : (typeof args.url === 'string' ? args.url : null)
  const errorMessage = typeof res?.error === 'string' ? res.error : null

  // Error or no fileUrl: fall back to JSON
  if (status === 'error' || (!fileUrl && !errorMessage)) {
    return (
      <>
        <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
        {result !== undefined && (
          <JsonViewer
            data={result}
            label={t('tools.renderers.output')}
            labelClassName={status === 'error' ? 'text-destructive' : undefined}
            maxHeight="max-h-60"
          />
        )}
      </>
    )
  }

  if (errorMessage && !fileUrl) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {errorMessage}
      </div>
    )
  }

  const fileName = (() => {
    if (!fileUrl) return 'screenshot'
    try { return new URL(fileUrl).pathname.split('/').filter(Boolean).pop() || 'screenshot' } catch { return 'screenshot' }
  })()

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-border overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border/50">
          <Camera className="size-3 text-muted-foreground shrink-0" />
          {pageUrl && <span className="text-foreground truncate font-mono">{pageUrl}</span>}
          {res?.full_page === true && (
            <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
              full page
            </span>
          )}
        </div>

        {/* Thumbnail */}
        {fileUrl && (
          <div className="relative group bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt={fileName}
              loading="lazy"
              onClick={() => setLightboxOpen(true)}
              className="block max-h-72 w-full cursor-zoom-in object-contain"
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={t('tools.renderers.openLightbox', 'Open full size')}
              className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100"
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Raw toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {showRaw ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t('tools.renderers.rawJson')}
      </button>

      {showRaw && (
        <>
          <JsonViewer data={args} label={t('tools.renderers.input')} maxHeight="max-h-40" />
          {result !== undefined && (
            <JsonViewer
              data={result}
              label={t('tools.renderers.output')}
              maxHeight="max-h-60"
            />
          )}
        </>
      )}

      {lightboxOpen && fileUrl && (
        <ImageLightbox
          file={{ id: fileUrl, name: fileName, url: fileUrl, mimeType: 'image/png', size: 0 }}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
