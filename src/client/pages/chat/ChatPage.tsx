import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/client/lib/lazy-with-retry'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/client/components/ui/sidebar'
import { AppSidebar } from '@/client/components/sidebar/AppSidebar'
import { ChatPanel } from '@/client/components/chat/ChatPanel'

// Lazy-load modals — not needed on initial render
const KinFormModal = lazy(() => import('@/client/components/kin/KinFormModal').then(m => ({ default: m.KinFormModal })))
const MiniAppViewer = lazy(() => import('@/client/components/mini-app/MiniAppViewer').then(m => ({ default: m.MiniAppViewer })))
import { useKins } from '@/client/hooks/useKins'
import { ConnectionBanner } from '@/client/components/common/ConnectionBanner'
import { CommandPalette } from '@/client/components/common/CommandPalette'
import { KeyboardShortcutsDialog } from '@/client/components/common/KeyboardShortcutsDialog'
import { StatusNotifications } from '@/client/components/common/StatusNotifications'
import { Button } from '@/client/components/ui/button'
import { SetupChecklist } from '@/client/components/common/SetupChecklist'
import { useDocumentTitle } from '@/client/hooks/useDocumentTitle'
import { useUnreadWhileHidden } from '@/client/hooks/useUnreadWhileHidden'
import { useFaviconBadge } from '@/client/hooks/useFaviconBadge'
import { Bot, ChevronRight, Command, MessageSquare, Network, Plus, Sparkles } from 'lucide-react'
import { useUnreadPerKin } from '@/client/hooks/useUnreadPerKin'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { api } from '@/client/lib/api'

interface ChatPageProps {
  /** Open the global settings modal (mounted at App.tsx root). */
  onOpenSettings: (section?: string, filters?: { kinId?: string }) => void
  /** Open the global account dialog (mounted at App.tsx root). */
  onOpenAccount: () => void
}

export function ChatPage({ onOpenSettings, onOpenAccount }: ChatPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    kins,
    llmModels,
    imageModels,
    isLoading: kinsLoading,
    kinQueueState,
    getKin,
    createKin,
    updateKin,
    deleteKin,
    uploadAvatar,
    generateAvatarPreview,
    generateKinConfig,
    generateAvatarPreviewFromConfig,
    hasImageCapability,
    reorderKins,
    fetchContextUsage,
    refetch: refetchKins,
    refetchModels,
  } = useKins()

  // Derive selected kin from URL (/kin/:slug)
  const selectedKinSlug = location.pathname.match(/^\/kin\/([^/]+)/)?.[1] ?? null

  // Persist the last selected kin so navigating away (Projects, etc.) and back
  // doesn't drop the selection. Restored once on first visit to "/" when we
  // have a stored slug matching an existing kin.
  useEffect(() => {
    if (selectedKinSlug) {
      try { localStorage.setItem('kinbot:lastSelectedKinSlug', selectedKinSlug) } catch { /* ignore */ }
    }
  }, [selectedKinSlug])

  useEffect(() => {
    if (selectedKinSlug || kinsLoading || kins.length === 0) return
    if (location.pathname !== '/') return
    let stored: string | null = null
    try { stored = localStorage.getItem('kinbot:lastSelectedKinSlug') } catch { /* ignore */ }
    if (!stored) return
    if (!kins.some((k) => k.slug === stored)) return
    navigate(`/kin/${stored}`, { replace: true })
  }, [selectedKinSlug, kinsLoading, kins, location.pathname, navigate])

  // Detect kins whose model is no longer served by any provider
  const unavailableKinIds = useMemo(() => {
    if (llmModels.length === 0) return new Set<string>()
    return new Set(
      kins.filter((k) => !llmModels.some((m) => m.id === k.model)).map((k) => k.id),
    )
  }, [kins, llmModels])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKin, setEditingKin] = useState<Awaited<ReturnType<typeof getKin>> | null>(null)

  // Settings + account modals are owned by App.tsx (AuthenticatedShell) and rendered there.
  // ChatPage calls the props directly to open them. We keep a local alias for backwards
  // compatibility with the existing onOpenSettings prop chain through children.
  const handleOpenSettings = onOpenSettings

  const handleSelectKin = (slug: string) => {
    const kin = kins.find((k) => k.slug === slug)
    if (kin) clearKinUnread(kin.id)
    navigate(`/kin/${slug}`)
  }

  const handleOpenCreateModal = () => {
    refetchModels()
    setShowCreateModal(true)
  }

  // Onboarding is complete when at least one LLM is configured AND at least
  // one Kin exists. The Hub Kin distinction was retired — every Kin is a
  // first-class citizen now that channels bind directly to any of them.
  const onboardingComplete = llmModels.length > 0 && kins.length > 0

  // Suppress the onboarding checklist while initial data is still loading.
  // Without this, the chat momentarily renders the checklist when arriving
  // on "/" before kins/models have been fetched, then flips to the
  // "Select a kin" placeholder once data lands. Showing nothing during
  // load is much calmer than the flash.
  //
  // We rely on `kinsLoading` alone — gating on `llmModels.length > 0 ||
  // kins.length > 0` used to leave a freshly-onboarded user (zero of
  // everything) stuck on a blank screen forever.
  const initialDataLoaded = !kinsLoading

  const handleOpenEditModal = async (kinId?: string) => {
    const id = kinId ?? selectedKin?.id
    if (!id) return
    refetchModels()
    try {
      const detail = await getKin(id)
      setEditingKin(detail)
      setShowEditModal(true)
    } catch {
      // Ignore errors
    }
  }

  const handleDeleteKin = async (id: string) => {
    await deleteKin(id)
    setEditingKin(null)
    if (selectedKin?.id === id) navigate('/')
  }

  const handleModelChange = useCallback(async (kinId: string, modelId: string, providerId: string) => {
    try {
      await updateKin(kinId, { model: modelId, providerId: providerId || null })
    } catch {
      // Ignore errors
    }
  }, [updateKin])

  const selectedKin = kins.find((k) => k.slug === selectedKinSlug)

  // Fetch context usage when selecting a kin so the token counter is populated immediately
  useEffect(() => {
    if (selectedKin?.id) {
      fetchContextUsage(selectedKin.id)
    }
  }, [selectedKin?.id, fetchContextUsage])

  // Dynamic browser tab title — shows selected Kin name + processing state
  const selectedKinProcessing = selectedKin
    ? kinQueueState.get(selectedKin.id)?.isProcessing ?? false
    : false
  const unreadCount = useUnreadWhileHidden(selectedKin?.id ?? null)
  const { unreadCounts: unreadPerKin, clearUnread: clearKinUnread } = useUnreadPerKin(selectedKin?.id ?? null)
  useDocumentTitle(selectedKin?.name, selectedKinProcessing, unreadCount)
  useFaviconBadge(unreadCount)

  // Global keyboard shortcuts for kin navigation & actions
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Cmd/Ctrl + 1-9 → switch to kin by index
      const digit = parseInt(e.key, 10)
      if (digit >= 1 && digit <= 9 && !e.shiftKey && !e.altKey) {
        const kin = kins[digit - 1]
        if (kin) {
          e.preventDefault()
          navigate(`/kin/${kin.slug}`)
        }
        return
      }

      // Cmd/Ctrl + Shift + N → create new kin
      if (e.key.toLowerCase() === 'n' && e.shiftKey && !e.altKey) {
        e.preventDefault()
        handleOpenCreateModal()
        return
      }

      // Cmd/Ctrl + , → open settings
      if (e.key === ',' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        handleOpenSettings()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [kins, navigate, handleOpenSettings])

  // The shadcn SidebarProvider wrapper defaults to `min-h-svh` (full viewport
  // height). We're now inside an AuthenticatedShell with an AppTopBar above
  // us, so the available height is `100vh - topbar`. Override the wrapper's
  // min-h-svh to `h-full min-h-0` so it matches its parent (the page slot below
  // AppTopBar). Without this, the wrapper overflows the viewport and the kin's
  // header gets pushed past the bottom.
  return (
    <div className="h-full overflow-hidden">
    <SidebarProvider className="!min-h-0 !h-full">
      <AppSidebar
        selectedKinId={selectedKin?.id ?? null}
        kins={kins}
        llmModels={llmModels}
        selectedKinSlug={selectedKinSlug}
        unavailableKinIds={unavailableKinIds}
        kinQueueState={kinQueueState}
        unreadCounts={unreadPerKin}
        onSelectKin={handleSelectKin}
        onCreateKin={handleOpenCreateModal}
        onEditKin={handleOpenEditModal}
        onDeleteKin={handleDeleteKin}
        onReorderKins={reorderKins}
        onOpenSettings={handleOpenSettings}
      />

      <SidebarInset className="min-h-0">
        <div className="flex h-full min-h-0">
        <div className="flex h-full min-w-0 min-h-0 flex-1 flex-col">
          {/* Thin local bar — only hosts the SidebarTrigger which depends on
              SidebarProvider context (scoped to this page). Global actions
              (brand, SSE, palette, theme, notifications, user menu) live in
              <AppTopBar /> at App.tsx root. */}
          <div className="flex h-10 shrink-0 items-center border-b px-2">
            <SidebarTrigger />
          </div>

          {/* Connection lost banner */}
          <ConnectionBanner />

          {/* Onboarding progress banner removed alongside the Hub Kin
              concept — the per-step banner mapped 1:1 to 'create hub'
              / 'create specialist' which are no longer distinct. The
              full setup checklist below replaces the per-step nudge. */}

          {/* Page content */}
          <Routes>
            <Route
              path="*"
              element={
                selectedKin ? (
                  <ChatPanel
                    key={selectedKin.id}
                    kin={{
                      id: selectedKin.id,
                      name: selectedKin.name,
                      role: selectedKin.role,
                      model: selectedKin.model,
                      providerId: selectedKin.providerId ?? null,
                      avatarUrl: selectedKin.avatarUrl,
                      activeProjectId: selectedKin.activeProjectId,
                      thinkingEnabled: selectedKin.thinkingEnabled,
                      thinkingEffort: selectedKin.thinkingEffort,
                    }}
                    llmModels={llmModels}
                    modelUnavailable={unavailableKinIds.has(selectedKin.id)}
                    queueState={kinQueueState.get(selectedKin.id)}
                    onModelChange={(modelId, providerId) => handleModelChange(selectedKin.id, modelId, providerId)}
                    onEditKin={() => handleOpenEditModal()}
                    onOpenSettings={handleOpenSettings}
                  />
                ) : (
                  /* `m-auto` on the child centers vertically when content
                     fits; on short viewports the child overflows and the
                     parent's `overflow-y-auto` lets the user scroll. Using
                     `justify-center` here would clip the top of overflowing
                     content (no way to scroll up). */
                  <div className="surface-chat flex flex-1 flex-col items-center overflow-y-auto p-6">
                    {!initialDataLoaded ? (
                      /* Still loading kins/models — render nothing rather than
                         flashing the onboarding checklist for a few hundred ms. */
                      null
                    ) : !onboardingComplete ? (
                      /* ── Onboarding not finished: show full setup checklist ── */
                      <div className="m-auto w-full max-w-md">
                        <SetupChecklist
                          variant="inline"
                          onCreateKin={handleOpenCreateModal}
                          onOpenSettings={handleOpenSettings}
                        />
                      </div>
                    ) : (
                      /* ── Onboarding done, no Kin selected ── */
                      <div className="m-auto text-center animate-fade-in-up space-y-4">
                        <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                          <Bot className="size-8 text-primary" />
                        </div>
                        <p className="text-muted-foreground">
                          {t('chat.selectKin')}
                        </p>
                        <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground/60">
                          <div className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                              <Command className="size-2.5" />K
                            </kbd>
                            <span>{t('chat.shortcutHint')}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <kbd className="inline-flex items-center rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                              ?
                            </kbd>
                            <span>{t('chat.shortcutsHint')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
            />
          </Routes>
        </div>
        {/* Side panel (task / ticket / mini-app) — mounted at page level so
            it works even when no Kin is selected (selecting a task from the
            sidebar still opens its detail view). */}
        <Suspense fallback={null}>
          <MiniAppViewer />
        </Suspense>
        </div>
      </SidebarInset>

      {/* Lazy-loaded modals */}
      <Suspense fallback={null}>
        {/* Create Kin modal */}
        {showCreateModal && (
          <KinFormModal
            open={showCreateModal}
            onOpenChange={setShowCreateModal}
            llmModels={llmModels}
            imageModels={imageModels}
            onCreateKin={createKin}
            onUpdateKin={updateKin}
            onUploadAvatar={uploadAvatar}
            onGenerateAvatarPreview={generateAvatarPreview}
            onGenerateKinConfig={generateKinConfig}
            onGenerateAvatarPreviewFromConfig={generateAvatarPreviewFromConfig}
            hasImageCapability={hasImageCapability}
            onOpenSettings={onOpenSettings}
          />
        )}

        {/* Edit Kin modal */}
        {showEditModal && (
          <KinFormModal
            open={showEditModal}
            onOpenChange={setShowEditModal}
            llmModels={llmModels}
            imageModels={imageModels}
            kin={editingKin}
            onUpdateKin={updateKin}
            onDeleteKin={handleDeleteKin}
            onUploadAvatar={uploadAvatar}
            onGenerateAvatarPreview={generateAvatarPreview}
            hasImageCapability={hasImageCapability}
            onOpenSettings={onOpenSettings}
          />
        )}

        {/* Account + Settings modals are now mounted at App.tsx root (AuthenticatedShell) */}
      </Suspense>

      {/* Command palette (Cmd+K) */}
      <CommandPalette
        kins={kins}
        onSelectKin={handleSelectKin}
        onCreateKin={handleOpenCreateModal}
        onOpenSettings={handleOpenSettings}
      />

      {/* Keyboard shortcuts help (?) */}
      <KeyboardShortcutsDialog />

      {/* Real-time status change notifications */}
      <StatusNotifications />
    </SidebarProvider>
    </div>
  )
}
