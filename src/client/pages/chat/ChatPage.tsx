import { useState, useMemo, useCallback, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/client/components/ui/sidebar'
import { AppSidebar } from '@/client/components/sidebar/AppSidebar'
import { KinFormModal } from '@/client/components/kin/KinFormModal'
import { ChatPanel } from '@/client/components/chat/ChatPanel'
import { SettingsModal } from '@/client/pages/settings/SettingsPage'
import { AccountPage } from '@/client/pages/account/AccountPage'
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
import { Bot, Command, Maximize2, MessageSquare, Minimize2, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { useFocusMode } from '@/client/hooks/useFocusMode'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'

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

  const { focusMode, toggleFocusMode, exitFocusMode } = useFocusMode()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKin, setEditingKin] = useState<Awaited<ReturnType<typeof getKin>> | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>()

  const handleOpenSettings = useCallback((section?: string) => {
    setSettingsInitialSection(section)
    setSettingsOpen(true)
  }, [])

  const handleSelectKin = (slug: string) => {
    navigate(`/kin/${slug}`)
  }

  const handleOpenCreateModal = () => {
    refetchModels()
    setShowCreateModal(true)
  }

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

  const handleModelChange = useCallback(async (kinId: string, model: string) => {
    try {
      await updateKin(kinId, { model })
    } catch {
      // Ignore errors
    }
  }, [updateKin])

  const selectedKin = kins.find((k) => k.slug === selectedKinSlug)

  // Dynamic browser tab title — shows selected Kin name + processing state
  const selectedKinProcessing = selectedKin
    ? kinQueueState.get(selectedKin.id)?.isProcessing ?? false
    : false
  const unreadCount = useUnreadWhileHidden(selectedKin?.id ?? null)
  useDocumentTitle(selectedKin?.name, selectedKinProcessing, unreadCount)

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
    <SidebarProvider data-focus-mode={focusMode || undefined}>
      <AppSidebar
        kins={kins}
        llmModels={llmModels}
        selectedKinSlug={selectedKinSlug}
        unavailableKinIds={unavailableKinIds}
        kinQueueState={kinQueueState}
        onSelectKin={handleSelectKin}
        onCreateKin={handleOpenCreateModal}
        onEditKin={handleOpenEditModal}
        onReorderKins={reorderKins}
        onOpenSettings={handleOpenSettings}
      />

      <SidebarInset>
        <div className="flex h-svh flex-col">
          {/* Shared header — hidden in focus mode */}
          <header className={cn(
            'surface-header sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b px-4 transition-all duration-200',
            focusMode && 'hidden',
          )}>
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex flex-1 items-center justify-between">
              <h2 className="text-sm text-muted-foreground">KinBot</h2>
              <div className="flex items-center gap-1">
                <SSEStatusIndicator />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" onClick={toggleFocusMode}>
                      <Maximize2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('focusMode.enter')}</TooltipContent>
                </Tooltip>
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
                  />
                )}
              </div>
            </div>
          </header>

          {/* Focus mode floating exit button */}
          {focusMode && (
            <div className="absolute top-2 right-2 z-50 animate-fade-in">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8 opacity-30 hover:opacity-100 transition-opacity shadow-md"
                    onClick={exitFocusMode}
                  >
                    <Minimize2 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('focusMode.exit')}</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Connection lost banner */}
          <ConnectionBanner />

          {/* Page content */}
          <Routes>
            <Route path="/account" element={<AccountPage />} />
            <Route
              path="*"
              element={
                selectedKin ? (
                  <ChatPanel
                    kin={{
                      id: selectedKin.id,
                      name: selectedKin.name,
                      role: selectedKin.role,
                      model: selectedKin.model,
                      avatarUrl: selectedKin.avatarUrl,
                    }}
                    llmModels={llmModels}
                    modelUnavailable={unavailableKinIds.has(selectedKin.id)}
                    queueState={kinQueueState.get(selectedKin.id)}
                    onModelChange={(model) => handleModelChange(selectedKin.id, model)}
                    onEditKin={() => handleOpenEditModal()}
                  />
                ) : (
                  <div className="surface-chat flex flex-1 flex-col items-center justify-center p-6">
                    {kins.length === 0 ? (
                      /* ── First-time: getting started checklist ── */
                      <GettingStartedChecklist
                        hasKins={false}
                        onCreateKin={handleOpenCreateModal}
                        onOpenSettings={handleOpenSettings}
                      />
                    ) : (
                      /* ── Has Kins, none selected ── */
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

      {/* Create Kin modal */}
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

      {/* Edit Kin modal */}
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

      {/* Settings modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} initialSection={settingsInitialSection} />

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
  )
}
