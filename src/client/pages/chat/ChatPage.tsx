import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/client/lib/lazy-with-retry'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/client/components/ui/sidebar'
import { AppSidebar } from '@/client/components/sidebar/AppSidebar'
import { MiniAppProvider } from '@/client/contexts/MiniAppContext'
import { ChatPanel } from '@/client/components/chat/ChatPanel'

// Lazy-load modals — not needed on initial render
const KinFormModal = lazy(() => import('@/client/components/kin/KinFormModal').then(m => ({ default: m.KinFormModal })))
const SettingsModal = lazy(() => import('@/client/pages/settings/SettingsPage').then(m => ({ default: m.SettingsModal })))
const AccountDialog = lazy(() => import('@/client/pages/account/AccountPage').then(m => ({ default: m.AccountDialog })))
import { useKins } from '@/client/hooks/useKins'
import { useAuth } from '@/client/hooks/useAuth'
import { Separator } from '@/client/components/ui/separator'
import { ThemeToggle } from '@/client/components/common/ThemeToggle'
import { PaletteToggle } from '@/client/components/common/PaletteToggle'
import { UserMenu } from '@/client/components/common/UserMenu'
import { NotificationBell } from '@/client/components/notifications/NotificationBell'
import { SSEStatusIndicator } from '@/client/components/common/SSEStatusIndicator'
import { ConnectionBanner } from '@/client/components/common/ConnectionBanner'
import { CommandPalette } from '@/client/components/common/CommandPalette'
import { KeyboardShortcutsDialog } from '@/client/components/common/KeyboardShortcutsDialog'
import { StatusNotifications } from '@/client/components/common/StatusNotifications'
import { Button } from '@/client/components/ui/button'
import { GettingStartedChecklist } from '@/client/components/common/GettingStartedChecklist'
import { useDocumentTitle } from '@/client/hooks/useDocumentTitle'
import { useUnreadWhileHidden } from '@/client/hooks/useUnreadWhileHidden'
import { useFaviconBadge } from '@/client/hooks/useFaviconBadge'
import { Bot, ChevronRight, Command, MessageSquare, Network, Plus, Sparkles } from 'lucide-react'
import { useUnreadPerKin } from '@/client/hooks/useUnreadPerKin'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { api } from '@/client/lib/api'

export function ChatPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    kins,
    llmModels,
    imageModels,
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

  // Detect kins whose model is no longer served by any provider
  const unavailableKinIds = useMemo(() => {
    if (llmModels.length === 0) return new Set<string>()
    return new Set(
      kins.filter((k) => !llmModels.some((m) => m.id === k.model)).map((k) => k.id),
    )
  }, [kins, llmModels])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateHubModal, setShowCreateHubModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKin, setEditingKin] = useState<Awaited<ReturnType<typeof getKin>> | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>()
  const [accountOpen, setAccountOpen] = useState(false)

  const handleOpenSettings = useCallback((section?: string) => {
    setSettingsInitialSection(section)
    setSettingsOpen(true)
  }, [])

  const handleSelectKin = (slug: string) => {
    const kin = kins.find((k) => k.slug === slug)
    if (kin) clearKinUnread(kin.id)
    navigate(`/kin/${slug}`)
  }

  const handleOpenCreateModal = () => {
    refetchModels()
    setShowCreateModal(true)
  }

  const handleOpenCreateHubModal = () => {
    refetchModels()
    setShowCreateHubModal(true)
  }

  // Derive hub kin ID from the kins list
  const hubKinId = useMemo(() => kins.find((k) => k.isHub)?.id ?? null, [kins])

  // Onboarding is complete when we have providers + hub + at least one specialist kin
  const specialistKinCount = useMemo(() => kins.filter((k) => !k.isHub).length, [kins])
  const onboardingComplete = llmModels.length > 0 && !!hubKinId && specialistKinCount > 0

  // Create a Hub kin and auto-designate it
  const handleCreateHubKin = useCallback(async (data: Parameters<typeof createKin>[0]) => {
    const result = await createKin(data)
    // Auto-designate as Hub and refresh kin list so checklist updates immediately
    await api.put('/settings/hub', { kinId: result.id })
    await refetchKins()
    return result
  }, [createKin, refetchKins])

  // Designate an existing kin as Hub
  const handleSetAsHub = useCallback(async (kinId: string) => {
    await api.put('/settings/hub', { kinId })
    await refetchKins()
  }, [refetchKins])

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

  return (
    <MiniAppProvider>
    <SidebarProvider>
      <AppSidebar
        selectedKinId={selectedKin?.id ?? null}
        kins={kins}
        llmModels={llmModels}
        selectedKinSlug={selectedKinSlug}
        unavailableKinIds={unavailableKinIds}
        kinQueueState={kinQueueState}
        onSelectKin={handleSelectKin}
        onCreateKin={handleOpenCreateModal}
        onEditKin={handleOpenEditModal}
        onDeleteKin={handleDeleteKin}
        onSetAsHub={handleSetAsHub}
        onReorderKins={reorderKins}
        onOpenSettings={handleOpenSettings}
      />

      <SidebarInset>
        <div className="flex h-svh flex-col">
          <header className="surface-header sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex flex-1 items-center justify-between">
              <h2 className="text-sm text-muted-foreground">KinBot</h2>
              <div className="flex items-center gap-1">
                <SSEStatusIndicator />
                <PaletteToggle />
                <ThemeToggle />
                {user && <NotificationBell onOpenSettings={handleOpenSettings} />}
                {user && (
                  <UserMenu
                    user={{
                      firstName: user.firstName,
                      lastName: user.lastName,
                      email: user.email,
                      avatarUrl: user.avatarUrl,
                    }}
                    onLogout={logout}
                    onOpenSettings={() => handleOpenSettings()}
                    onOpenAccount={() => setAccountOpen(true)}
                  />
                )}
              </div>
            </div>
          </header>

          {/* Connection lost banner */}
          <ConnectionBanner />

          {/* Onboarding progress banner — shown in chat when setup isn't complete */}
          {!onboardingComplete && selectedKin && (() => {
            const step = !hubKinId ? { num: 2, label: t('chat.welcome.step2Title'), action: t('chat.welcome.step2Action'), onClick: handleOpenCreateHubModal }
              : specialistKinCount === 0 ? { num: 3, label: t('chat.welcome.step3Title'), action: t('chat.welcome.step3Action'), onClick: handleOpenCreateModal }
              : null
            if (!step) return null
            return (
              <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Network className="size-3 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('chat.welcome.onboardingStep', { current: step.num, total: 4 })}
                  </span>
                  <span className="text-xs font-medium truncate">{step.label}</span>
                </div>
                <Button size="sm" variant="ghost" className="shrink-0 gap-1 text-xs text-primary h-7" onClick={step.onClick}>
                  {step.action}
                  <ChevronRight className="size-3" />
                </Button>
              </div>
            )
          })()}

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
                    }}
                    llmModels={llmModels}
                    modelUnavailable={unavailableKinIds.has(selectedKin.id)}
                    queueState={kinQueueState.get(selectedKin.id)}
                    onModelChange={(modelId, providerId) => handleModelChange(selectedKin.id, modelId, providerId)}
                    onEditKin={() => handleOpenEditModal()}
                  />
                ) : (
                  <div className="surface-chat flex flex-1 flex-col items-center justify-center p-6">
                    {!onboardingComplete ? (
                      /* ── Onboarding not finished: show checklist ── */
                      <GettingStartedChecklist
                        specialistKinCount={specialistKinCount}
                        hubKinId={hubKinId}
                        onCreateHub={handleOpenCreateHubModal}
                        onCreateKin={handleOpenCreateModal}
                        onOpenSettings={handleOpenSettings}
                      />
                    ) : (
                      /* ── Onboarding done, no Kin selected ── */
                      <div className="text-center animate-fade-in-up space-y-4">
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
          />
        )}

        {/* Create Hub Kin modal */}
        {showCreateHubModal && (
          <KinFormModal
            open={showCreateHubModal}
            onOpenChange={setShowCreateHubModal}
            llmModels={llmModels}
            imageModels={imageModels}
            onCreateKin={handleCreateHubKin}
            onUpdateKin={updateKin}
            onUploadAvatar={uploadAvatar}
            onGenerateAvatarPreview={generateAvatarPreview}
            onGenerateKinConfig={generateKinConfig}
            onGenerateAvatarPreviewFromConfig={generateAvatarPreviewFromConfig}
            hasImageCapability={hasImageCapability}
            hubMode
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
          />
        )}

        {/* Account modal */}
        {accountOpen && <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />}

        {/* Settings modal */}
        {settingsOpen && <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} initialSection={settingsInitialSection} />}
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
    </MiniAppProvider>
  )
}
