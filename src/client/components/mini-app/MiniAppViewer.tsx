import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMiniAppPanel } from '@/client/contexts/MiniAppContext'
import { Button } from '@/client/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/client/components/ui/alert-dialog'
import { Input } from '@/client/components/ui/input'
import { X, RotateCw, Maximize2, Minimize2 } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/client/lib/api'
import { toast } from 'sonner'
import type { MiniAppSummary } from '@/shared/types'

export function MiniAppViewer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { panelOpen, activeAppId, activeAppVersion, isFullPage, customTitle, openApp, closePanel, toggleFullPage, setFullPage, setCustomTitle, setBadge } = useMiniAppPanel()
  const [app, setApp] = useState<MiniAppSummary | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Dialog state for confirm/prompt
  const [dialog, setDialog] = useState<{
    type: 'confirm' | 'prompt'
    callbackId: string
    message: string
    title: string
    confirmLabel: string
    cancelLabel: string
    variant?: 'default' | 'destructive'
    placeholder?: string
    defaultValue?: string
  } | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const sendDialogResult = useCallback((callbackId: string, value: unknown) => {
    if (!iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({
      source: 'kinbot-parent',
      type: 'dialog-result',
      callbackId,
      value,
    }, '*')
  }, [])

  // Fetch app details when activeAppId changes
  useEffect(() => {
    if (!activeAppId) {
      setApp(null)
      return
    }
    let cancelled = false
    api.get<{ app: MiniAppSummary }>(`/mini-apps/${activeAppId}`).then((data) => {
      if (!cancelled) setApp(data.app)
    }).catch(() => {
      if (!cancelled) setApp(null)
    })
    return () => { cancelled = true }
  }, [activeAppId])

  // Reload iframe when version changes
  useEffect(() => {
    if (activeAppVersion > 0) {
      setIframeKey((k) => k + 1)
    }
  }, [activeAppVersion])

  // Send app metadata to iframe when it loads
  const sendAppMeta = useCallback(() => {
    if (!iframeRef.current?.contentWindow || !app) return
    iframeRef.current.contentWindow.postMessage({
      source: 'kinbot-parent',
      type: 'app-meta',
      data: {
        id: app.id,
        name: app.name,
        slug: app.slug,
        description: app.description,
        icon: app.icon,
        kinId: app.kinId,
        kinName: app.kinName,
        version: app.version,
        isFullPage,
      },
    }, '*')
  }, [app, isFullPage])

  // Notify iframe when full-page mode changes
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage({
      source: 'kinbot-parent',
      type: 'fullpage-changed',
      data: { isFullPage },
    }, '*')
  }, [isFullPage])

  // Handle postMessage from mini-app SDK
  useEffect(() => {
    function handleMessage(ev: MessageEvent) {
      const msg = ev.data
      if (!msg || msg.source !== 'kinbot-sdk') return

      switch (msg.type) {
        case 'toast': {
          const text = String(msg.message || '').slice(0, 500)
          const toastType = msg.toastType as string
          if (toastType === 'success') toast.success(text)
          else if (toastType === 'error') toast.error(text)
          else if (toastType === 'warning') toast.warning(text)
          else toast.info(text)
          break
        }
        case 'navigate': {
          const path = String(msg.path || '/')
          // Only allow internal navigation (starts with /)
          if (path.startsWith('/')) navigate(path)
          break
        }
        case 'ready': {
          sendAppMeta()
          break
        }
        case 'fullpage': {
          const requested = Boolean(msg.value)
          setFullPage(requested)
          break
        }
        case 'confirm': {
          setDialog({
            type: 'confirm',
            callbackId: String(msg.callbackId),
            message: String(msg.message || ''),
            title: String(msg.title || '') || t('miniApps.dialog.confirmTitle'),
            confirmLabel: String(msg.confirmLabel || '') || t('miniApps.dialog.confirm'),
            cancelLabel: String(msg.cancelLabel || '') || t('miniApps.dialog.cancel'),
            variant: msg.variant === 'destructive' ? 'destructive' : 'default',
          })
          break
        }
        case 'prompt': {
          const dv = String(msg.defaultValue || '')
          setPromptValue(dv)
          setDialog({
            type: 'prompt',
            callbackId: String(msg.callbackId),
            message: String(msg.message || ''),
            title: String(msg.title || '') || t('miniApps.dialog.promptTitle'),
            confirmLabel: String(msg.confirmLabel || '') || t('miniApps.dialog.ok'),
            cancelLabel: String(msg.cancelLabel || '') || t('miniApps.dialog.cancel'),
            placeholder: String(msg.placeholder || ''),
            defaultValue: dv,
          })
          break
        }
        case 'set-title': {
          const title = String(msg.title || '')
          setCustomTitle(title || null)
          break
        }
        case 'set-badge': {
          if (activeAppId) {
            setBadge(activeAppId, msg.value ?? null)
          }
          break
        }
        case 'open-app': {
          const slug = String(msg.slug || '')
          if (!slug || !app?.kinId) break
          // Resolve slug to appId via API, then open
          api.get<{ app: MiniAppSummary }>(`/mini-apps/by-slug/${app.kinId}/${encodeURIComponent(slug)}`)
            .then((data) => {
              if (data.app?.id) {
                openApp(data.app.id)
              } else {
                toast.error(t('miniApps.appNotFound', { slug }))
              }
            })
            .catch(() => {
              toast.error(t('miniApps.appNotFound', { slug }))
            })
          break
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [navigate, sendAppMeta, setFullPage, setCustomTitle, setBadge, activeAppId, app, openApp, t])

  // Escape key exits full-page mode
  useEffect(() => {
    if (!isFullPage) return
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setFullPage(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullPage, setFullPage])

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1)
  }, [])

  const handleIframeLoad = useCallback(() => {
    sendAppMeta()
  }, [sendAppMeta])

  const iframeSrc = activeAppId
    ? `/api/mini-apps/${activeAppId}/serve?v=${activeAppVersion}`
    : ''

  const handleDialogCancel = useCallback(() => {
    if (!dialog) return
    sendDialogResult(dialog.callbackId, dialog.type === 'confirm' ? false : null)
    setDialog(null)
  }, [dialog, sendDialogResult])

  const handleDialogConfirm = useCallback(() => {
    if (!dialog) return
    sendDialogResult(dialog.callbackId, dialog.type === 'confirm' ? true : promptValue)
    setDialog(null)
  }, [dialog, sendDialogResult, promptValue])

  const dialogElement = dialog && (
    <AlertDialog open onOpenChange={(open) => { if (!open) handleDialogCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
          <AlertDialogDescription>{dialog.message}</AlertDialogDescription>
        </AlertDialogHeader>
        {dialog.type === 'prompt' && (
          <div className="px-1 py-2">
            <Input
              autoFocus
              placeholder={dialog.placeholder}
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleDialogConfirm() }}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDialogCancel}>
            {dialog.cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDialogConfirm}
            className={dialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {dialog.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // Full-page mode: render as overlay
  if (isFullPage && panelOpen && activeAppId) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {dialogElement}
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          {app?.icon && <span className="text-base">{app.icon}</span>}
          <span className="flex-1 truncate text-sm font-medium">
            {customTitle || (app?.name ?? '...')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleRefresh}
            title={t('miniApps.refresh')}
          >
            <RotateCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleFullPage}
            title={t('miniApps.exitFullPage')}
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={closePanel}
            title={t('miniApps.closePanel')}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Iframe */}
        <iframe
          ref={iframeRef}
          key={iframeKey}
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          className="min-h-0 flex-1 w-full border-0"
          title={app?.name ?? 'Mini App'}
          onLoad={handleIframeLoad}
        />
      </div>
    )
  }

  // Side panel mode (default)
  return (
    <div
      className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-out ${
        panelOpen ? 'w-[480px] lg:w-[600px]' : 'w-0'
      }`}
    >
      <div className="flex h-full w-[480px] lg:w-[600px] flex-col border-l border-border">
        {dialogElement}
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          {app?.icon && <span className="text-base">{app.icon}</span>}
          <span className="flex-1 truncate text-sm font-medium">
            {customTitle || (app?.name ?? '...')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={handleRefresh}
            title={t('miniApps.refresh')}
          >
            <RotateCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleFullPage}
            title={t('miniApps.fullPage')}
          >
            <Maximize2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={closePanel}
            title={t('miniApps.closePanel')}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Iframe */}
        {activeAppId && (
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={iframeSrc}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            className="min-h-0 flex-1 w-full border-0"
            title={app?.name ?? 'Mini App'}
            onLoad={handleIframeLoad}
          />
        )}
      </div>
    </div>
  )
}
