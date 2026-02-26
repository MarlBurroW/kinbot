import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/client/components/ui/alert-dialog'
import { Input } from '@/client/components/ui/input'
import { Textarea } from '@/client/components/ui/textarea'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Alert, AlertDescription } from '@/client/components/ui/alert'
import { AvatarPickerModal, type AvatarPickerResult } from '@/client/components/kin/AvatarPickerModal'
import { KinToolsTab } from '@/client/components/kin/KinToolsTab'
import { MemoryList } from '@/client/components/memory/MemoryList'
import { AlertCircle, ArrowLeft, Brain, Camera, Loader2, Settings, Sparkles, Trash2, Wrench } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import { cn } from '@/client/lib/utils'
import { getErrorMessage } from '@/client/lib/api'
import { TOOL_DOMAIN_MAP } from '@/shared/constants'
import type { KinToolConfig } from '@/shared/types'
import type { GeneratedKinConfig } from '@/client/hooks/useKins'

interface Model {
  id: string
  name: string
  providerId: string
  providerName: string
  providerType: string
  capability: string
}

interface KinDetail {
  id: string
  slug: string
  name: string
  role: string
  avatarUrl: string | null
  character: string
  expertise: string
  model: string
  providerId?: string | null
  toolConfig?: KinToolConfig | null
}

interface KinFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  llmModels: Model[]
  imageModels?: Model[]
  onUploadAvatar: (kinId: string, file: File) => Promise<string>
  onGenerateAvatarPreview?: (
    kinId: string,
    mode: 'auto' | 'prompt',
    prompt?: string,
    imageModel?: { providerId: string; modelId: string },
  ) => Promise<string>
  hasImageCapability?: boolean
  // Mode create
  onCreateKin?: (data: {
    name: string
    role: string
    character: string
    expertise: string
    model: string
    providerId?: string | null
  }) => Promise<{ id: string }>
  // Mode edit
  kin?: KinDetail | null
  onUpdateKin?: (id: string, data: Record<string, unknown>) => Promise<unknown>
  onDeleteKin?: (id: string) => Promise<void>
  // Wizard helpers
  onGenerateKinConfig?: (data: {
    description?: string
    refinement?: string
    currentConfig?: Record<string, unknown>
    language?: string
  }) => Promise<GeneratedKinConfig>
  onGenerateAvatarPreviewFromConfig?: (data: {
    name: string
    role: string
    character: string
    expertise: string
  }) => Promise<string>
}

type TabId = 'general' | 'tools' | 'memory'
type WizardStep = 'describe' | 'form'

const TABS: Array<{ id: TabId; icon: typeof Settings; labelKey: string }> = [
  { id: 'general', icon: Settings, labelKey: 'kin.tabs.general' },
  { id: 'tools', icon: Wrench, labelKey: 'kin.tabs.tools' },
  { id: 'memory', icon: Brain, labelKey: 'kin.tabs.memory' },
]

/** Convert AI domain-level suggestions into KinToolConfig */
function buildToolConfigFromDomains(
  disableToolDomains: string[],
  enableOptInToolDomains: string[],
): KinToolConfig {
  const disabledNativeTools = Object.entries(TOOL_DOMAIN_MAP)
    .filter(([, domain]) => disableToolDomains.includes(domain))
    .map(([toolName]) => toolName)

  const enabledOptInTools = Object.entries(TOOL_DOMAIN_MAP)
    .filter(([, domain]) => enableOptInToolDomains.includes(domain))
    .map(([toolName]) => toolName)

  return {
    disabledNativeTools,
    mcpAccess: {},
    enabledOptInTools: enabledOptInTools.length > 0 ? enabledOptInTools : undefined,
  }
}

/** Convert data URL to File */
function dataUrlToFile(dataUrl: string): File {
  const [header = '', base64 = ''] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
  return new File([bytes], `avatar.${ext}`, { type: mime })
}

export function KinFormModal({
  open,
  onOpenChange,
  llmModels,
  imageModels,
  onUploadAvatar,
  onGenerateAvatarPreview,
  hasImageCapability = false,
  onCreateKin,
  kin,
  onUpdateKin,
  onDeleteKin,
  onGenerateKinConfig,
  onGenerateAvatarPreviewFromConfig,
}: KinFormModalProps) {
  const { t, i18n } = useTranslation()

  const isEdit = !!kin
  const defaultCharacter = t('kin.defaults.character')
  const defaultExpertise = t('kin.defaults.expertise')

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(isEdit ? 'form' : 'describe')
  const [wizardDescription, setWizardDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [wasAiGenerated, setWasAiGenerated] = useState(false)
  const [isAvatarGenerating, setIsAvatarGenerating] = useState(false)

  // Refine state
  const [refineText, setRefineText] = useState('')
  const [isRefining, setIsRefining] = useState(false)

  // Form state
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [role, setRole] = useState('')
  const [character, setCharacter] = useState(defaultCharacter)
  const [expertise, setExpertise] = useState(defaultExpertise)
  const [model, setModel] = useState('')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [toolConfig, setToolConfig] = useState<KinToolConfig | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Track if avatar generation was aborted (component unmount / new generation)
  const avatarAbortRef = useRef<AbortController | null>(null)

  // Sync form when kin changes (edit mode) or reset for create mode
  useEffect(() => {
    if (kin) {
      setName(kin.name)
      setSlug(kin.slug)
      setRole(kin.role)
      setCharacter(kin.character)
      setExpertise(kin.expertise)
      setModel(kin.model)
      setProviderId(kin.providerId ?? null)
      setToolConfig(kin.toolConfig ?? null)
      setAvatarPreview(kin.avatarUrl)
      setWizardStep('form')
      setWasAiGenerated(false)
    } else {
      setName('')
      setSlug('')
      setRole('')
      setCharacter(defaultCharacter)
      setExpertise(defaultExpertise)
      setModel('')
      setProviderId(null)
      setToolConfig(null)
      setAvatarPreview(null)
      setWizardStep('describe')
      setWasAiGenerated(false)
      setWizardDescription('')
    }
    setAvatarFile(null)
    setError('')
    setActiveTab('general')
    setRefineText('')
    setIsGenerating(false)
    setIsRefining(false)
    setIsAvatarGenerating(false)
  }, [kin, defaultCharacter, defaultExpertise])

  // Derive providers that can serve the selected model
  const providersForModel = useMemo(() => {
    if (!model) return []
    const seen = new Set<string>()
    return llmModels
      .filter((m) => m.id === model)
      .filter((m) => {
        if (seen.has(m.providerId)) return false
        seen.add(m.providerId)
        return true
      })
  }, [model, llmModels])

  const showProviderSelector = providersForModel.length > 1

  // Reset providerId when model changes and current provider is no longer valid
  useEffect(() => {
    if (providerId && providersForModel.length > 0) {
      const stillValid = providersForModel.some((p) => p.providerId === providerId)
      if (!stillValid) setProviderId(null)
    }
  }, [model, providersForModel, providerId])

  /** Apply a generated config to the form fields */
  const applyGeneratedConfig = (config: GeneratedKinConfig) => {
    setName(config.name)
    setRole(config.role)
    setCharacter(config.character)
    setExpertise(config.expertise)

    // Apply suggested model if it exists in available models
    if (config.suggestedModel && llmModels.some((m) => m.id === config.suggestedModel)) {
      setModel(config.suggestedModel)
    }

    // Apply tool config from domain suggestions
    if (config.disableToolDomains || config.enableOptInToolDomains) {
      setToolConfig(buildToolConfigFromDomains(
        config.disableToolDomains ?? [],
        config.enableOptInToolDomains ?? [],
      ))
    }
  }

  /** Trigger background avatar generation from config fields */
  const triggerAvatarGeneration = (config: { name: string; role: string; character: string; expertise: string }) => {
    if (!hasImageCapability || !onGenerateAvatarPreviewFromConfig) return

    // Abort any previous avatar generation
    avatarAbortRef.current?.abort()
    const controller = new AbortController()
    avatarAbortRef.current = controller

    setIsAvatarGenerating(true)

    onGenerateAvatarPreviewFromConfig(config)
      .then((dataUrl) => {
        if (controller.signal.aborted) return
        setAvatarPreview(dataUrl)
        setAvatarFile(dataUrlToFile(dataUrl))
      })
      .catch(() => {
        // Silently ignore — user can generate manually
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsAvatarGenerating(false)
        }
      })
  }

  /** Handle wizard "Generate" button */
  const handleGenerate = async () => {
    if (!onGenerateKinConfig || !wizardDescription.trim()) return
    setIsGenerating(true)
    setError('')

    try {
      const config = await onGenerateKinConfig({
        description: wizardDescription.trim(),
        language: i18n.language,
      })

      applyGeneratedConfig(config)
      setWasAiGenerated(true)
      setWizardStep('form')

      // Trigger avatar generation in background
      triggerAvatarGeneration({
        name: config.name,
        role: config.role,
        character: config.character,
        expertise: config.expertise,
      })
    } catch {
      setError(t('kin.wizard.generateError'))
    } finally {
      setIsGenerating(false)
    }
  }

  /** Handle refine */
  const handleRefine = async () => {
    if (!onGenerateKinConfig || !refineText.trim()) return
    setIsRefining(true)
    setError('')

    try {
      const config = await onGenerateKinConfig({
        refinement: refineText.trim(),
        currentConfig: { name, role, character, expertise, model },
        language: i18n.language,
      })

      applyGeneratedConfig(config)
      setRefineText('')

      // Re-trigger avatar generation with updated config
      triggerAvatarGeneration({
        name: config.name,
        role: config.role,
        character: config.character,
        expertise: config.expertise,
      })
    } catch {
      setError(t('kin.wizard.generateError'))
    } finally {
      setIsRefining(false)
    }
  }

  const handleAvatarConfirm = (result: AvatarPickerResult) => {
    if (result.mode === 'upload') {
      setAvatarFile(result.file)
      setAvatarPreview(result.preview)
    } else {
      setAvatarFile(dataUrlToFile(result.url))
      setAvatarPreview(result.url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isEdit && onUpdateKin) {
        await onUpdateKin(kin.id, { name, slug, role, character, expertise, model, providerId, toolConfig })
        if (avatarFile) await onUploadAvatar(kin.id, avatarFile)
      } else if (onCreateKin) {
        const created = await onCreateKin({ name, role, character, expertise, model, providerId })
        if (avatarFile) await onUploadAvatar(created.id, avatarFile)
        // If tool config was set by wizard, update it after creation
        if (toolConfig && onUpdateKin) {
          await onUpdateKin(created.id, { toolConfig })
        }
      }
      onOpenChange(false)
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!kin || !onDeleteKin) return
    setIsDeleting(true)
    try {
      await onDeleteKin(kin.id)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('common.error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const initials = name.slice(0, 2).toUpperCase()

  // Check if wizard is available (has the generate config callback)
  const hasWizard = !!onGenerateKinConfig && !isEdit

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(85vh,720px)] max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
          {/* ─── WIZARD: Describe step ─── */}
          {hasWizard && wizardStep === 'describe' ? (
            <>
              <DialogHeader className="shrink-0 border-b px-6 py-4">
                <DialogTitle className="gradient-primary-text">
                  {t('kin.wizard.title')}
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-1 flex-col items-center justify-center px-8 py-10">
                <div className="w-full max-w-xl animate-fade-in-up space-y-6">
                  <p className="text-center text-muted-foreground">
                    {t('kin.wizard.subtitle')}
                  </p>

                  <Textarea
                    value={wizardDescription}
                    onChange={(e) => setWizardDescription(e.target.value)}
                    placeholder={t('kin.wizard.placeholder')}
                    className="gradient-border min-h-[120px] resize-none rounded-xl text-base"
                    style={{
                      backgroundImage:
                        'linear-gradient(color-mix(in oklch, var(--color-card) 80%, black), color-mix(in oklch, var(--color-card) 80%, black)), linear-gradient(135deg, var(--color-gradient-start), var(--color-gradient-mid), var(--color-gradient-end))',
                    }}
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && wizardDescription.trim()) {
                        handleGenerate()
                      }
                    }}
                  />

                  {error && (
                    <Alert variant="destructive" className="animate-scale-in">
                      <AlertCircle className="size-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setWizardStep('form')}
                      disabled={isGenerating}
                    >
                      {t('kin.wizard.skipManual')}
                    </Button>

                    <Button
                      type="button"
                      onClick={handleGenerate}
                      disabled={isGenerating || !wizardDescription.trim()}
                      className="btn-shine gradient-primary text-white"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t('kin.wizard.generating')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          {t('kin.wizard.generate')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ─── FORM: Standard create/edit ─── */}
              <DialogHeader className="shrink-0 border-b px-6 py-4">
                <DialogTitle>
                  {isEdit ? t('kin.edit.title') : t('kin.create.title')}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1">
                {/* Left sidebar navigation */}
                <nav className="w-48 shrink-0 border-r surface-sidebar overflow-y-auto py-4 px-3">
                  <ul className="flex w-full min-w-0 flex-col gap-1">
                    {TABS.map(({ id, icon: Icon, labelKey }) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setActiveTab(id)}
                          data-active={activeTab === id}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
                            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            activeTab === id
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                              : 'text-sidebar-foreground',
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{t(labelKey)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* Right content area */}
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {error && (
                    <div className="shrink-0 px-6 pt-4">
                      <Alert variant="destructive" className="animate-scale-in">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                      {activeTab === 'general' && (
                        <div className="space-y-4">
                          {/* Refine bar — only for AI-generated configs in create mode */}
                          {wasAiGenerated && !isEdit && (
                            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                              <Sparkles className="size-4 shrink-0 text-primary" />
                              <Input
                                value={refineText}
                                onChange={(e) => setRefineText(e.target.value)}
                                placeholder={t('kin.wizard.refinePlaceholder')}
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                disabled={isRefining}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && refineText.trim()) {
                                    e.preventDefault()
                                    handleRefine()
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleRefine}
                                disabled={isRefining || !refineText.trim()}
                              >
                                {isRefining ? (
                                  <>
                                    <Loader2 className="size-3 animate-spin" />
                                    {t('kin.wizard.refining')}
                                  </>
                                ) : (
                                  t('kin.wizard.refineSubmit')
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Avatar + Identity row */}
                          <div className="flex items-start gap-6">
                            {/* Avatar — click to open picker */}
                            <button
                              type="button"
                              onClick={() => setShowAvatarPicker(true)}
                              className="group relative shrink-0"
                            >
                              <Avatar className="size-20 ring-2 ring-border transition-all group-hover:ring-primary">
                                {isAvatarGenerating ? (
                                  <AvatarFallback className="text-base">
                                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                                  </AvatarFallback>
                                ) : avatarPreview ? (
                                  <AvatarImage src={avatarPreview} alt={name || 'Avatar'} />
                                ) : (
                                  <AvatarFallback className="text-base">
                                    {initials || <Camera className="size-6 text-muted-foreground" />}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                <Camera className="size-5 text-white" />
                              </div>
                            </button>

                            {/* Name, Role & Model */}
                            <div className="flex-1 space-y-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="kinFormName" className="inline-flex items-center gap-1.5">{t('kin.create.name')} <InfoTip content={t('kin.create.nameTip')} /></Label>
                                  <Input
                                    id="kinFormName"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('kin.create.namePlaceholder')}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="kinFormRole" className="inline-flex items-center gap-1.5">{t('kin.create.role')} <InfoTip content={t('kin.create.roleTip')} /></Label>
                                  <Input
                                    id="kinFormRole"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    placeholder={t('kin.create.rolePlaceholder')}
                                    required
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="inline-flex items-center gap-1.5">{t('kin.create.model')} <InfoTip content={t('kin.create.modelTip')} /></Label>
                                  <ModelPicker
                                    models={llmModels}
                                    value={model}
                                    onValueChange={setModel}
                                    placeholder={t('kin.create.modelPlaceholder')}
                                  />
                                </div>
                              </div>
                              {showProviderSelector && (
                                <div className="space-y-2">
                                  <Label>{t('kin.create.provider')}</Label>
                                  <Select
                                    value={providerId ?? '__auto__'}
                                    onValueChange={(v) => setProviderId(v === '__auto__' ? null : v)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__auto__">
                                        {t('kin.create.providerAuto')}
                                      </SelectItem>
                                      {providersForModel.map((p) => (
                                        <SelectItem key={p.providerId} value={p.providerId}>
                                          <span className="flex items-center gap-2">
                                            <ProviderIcon providerType={p.providerType} className="size-4" />
                                            {p.providerName}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">{t('kin.create.providerHint')}</p>
                                </div>
                              )}
                              {isEdit && (
                                <div className="space-y-2">
                                  <Label htmlFor="kinFormSlug">{t('kin.edit.slug')}</Label>
                                  <Input
                                    id="kinFormSlug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    placeholder="my-kin-slug"
                                  />
                                  <p className="text-xs text-muted-foreground">{t('kin.edit.slugHelp')}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Character */}
                          <div className="space-y-2">
                            <Label className="inline-flex items-center gap-1.5">{t('kin.create.character')} <InfoTip content={t('kin.create.characterTip')} /></Label>
                            <MarkdownEditor
                              value={character}
                              onChange={setCharacter}
                              height="180px"
                            />
                            <p className="text-xs text-muted-foreground">{t('kin.create.characterHint')}</p>
                          </div>

                          {/* Expertise */}
                          <div className="space-y-2">
                            <Label className="inline-flex items-center gap-1.5">{t('kin.create.expertise')} <InfoTip content={t('kin.create.expertiseTip')} /></Label>
                            <MarkdownEditor
                              value={expertise}
                              onChange={setExpertise}
                              height="180px"
                            />
                            <p className="text-xs text-muted-foreground">{t('kin.create.expertiseHint')}</p>
                          </div>
                        </div>
                      )}

                      {activeTab === 'tools' && (
                        <KinToolsTab
                          kinId={isEdit ? kin.id : null}
                          toolConfig={toolConfig}
                          onToolConfigChange={setToolConfig}
                        />
                      )}

                      {activeTab === 'memory' && isEdit && (
                        <MemoryList kinId={kin.id} compact />
                      )}

                      {activeTab === 'memory' && !isEdit && (
                        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                          {t('settings.memories.saveKinFirst')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 border-t px-6 py-3">
                    {isEdit ? (
                      <div className="flex items-center justify-between">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
                              <Trash2 className="size-4" />
                              {t('kin.settings.delete')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('kin.settings.delete')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('kin.settings.deleteConfirm')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete}>
                                {isDeleting ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  t('kin.settings.deleteAction')
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <Button type="submit" disabled={isLoading || !name || !role} className="btn-shine">
                          {isLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              {t('common.loading')}
                            </>
                          ) : (
                            t('kin.settings.save')
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        {hasWizard ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setWizardStep('describe')}
                          >
                            <ArrowLeft className="size-4" />
                            {t('kin.wizard.back')}
                          </Button>
                        ) : (
                          <div />
                        )}
                        <Button
                          type="submit"
                          disabled={isLoading || !name || !role || !model}
                          className="btn-shine"
                          size="lg"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              {t('common.loading')}
                            </>
                          ) : (
                            t('kin.create.submit')
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Avatar picker modal */}
      <AvatarPickerModal
        open={showAvatarPicker}
        onOpenChange={setShowAvatarPicker}
        currentAvatar={avatarPreview}
        kinName={name}
        kinId={isEdit ? kin?.id ?? null : null}
        hasImageCapability={hasImageCapability}
        imageModels={imageModels}
        onGenerateAvatarPreview={onGenerateAvatarPreview}
        onConfirm={handleAvatarConfirm}
      />
    </>
  )
}
