import { useState, useMemo, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/client/components/ui/sidebar'
import { AppSidebar } from '@/client/components/sidebar/AppSidebar'
import { KinFormModal } from '@/client/components/kin/KinFormModal'
import { ChatPanel } from '@/client/components/chat/ChatPanel'
import { SettingsPage } from '@/client/pages/settings/SettingsPage'
import { AccountPage } from '@/client/pages/account/AccountPage'
import { useKins } from '@/client/hooks/useKins'
import { useAuth } from '@/client/hooks/useAuth'
import { Separator } from '@/client/components/ui/separator'
import { ThemeToggle } from '@/client/components/common/ThemeToggle'
import { PaletteToggle } from '@/client/components/common/PaletteToggle'
import { MessageSquare } from 'lucide-react'

export function ChatPage() {
  const { t } = useTranslation()
  const { logout } = useAuth()
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

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKin, setEditingKin] = useState<Awaited<ReturnType<typeof getKin>> | null>(null)

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

  return (
    <SidebarProvider>
      <AppSidebar
        kins={kins}
        selectedKinSlug={selectedKinSlug}
        unavailableKinIds={unavailableKinIds}
        kinQueueState={kinQueueState}
        onSelectKin={handleSelectKin}
        onCreateKin={handleOpenCreateModal}
        onEditKin={handleOpenEditModal}
        onReorderKins={reorderKins}
        onLogout={logout}
      />

      <SidebarInset>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="*"
            element={
              <div className="flex h-svh flex-col">
                {/* Header */}
                <header className="surface-header sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b px-4">
                  <SidebarTrigger />
                  <Separator orientation="vertical" className="h-5" />
                  <div className="flex flex-1 items-center justify-between">
                    <h2 className="text-sm text-muted-foreground">KinBot</h2>
                    <div className="flex items-center gap-1">
                      <PaletteToggle />
                      <ThemeToggle />
                    </div>
                  </div>
                </header>

                {/* Chat content area */}
                {selectedKin ? (
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
                    <div className="text-center animate-fade-in-up">
                      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                        <MessageSquare className="size-8 text-primary" />
                      </div>
                      <p className="text-muted-foreground">
                        {t('chat.selectKin')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </Routes>
      </SidebarInset>

      {/* Create Kin modal */}
      <KinFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        llmModels={llmModels}
        imageModels={imageModels}
        onCreateKin={createKin}
        onUploadAvatar={uploadAvatar}
        onGenerateAvatarPreview={generateAvatarPreview}
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
    </SidebarProvider>
  )
}
