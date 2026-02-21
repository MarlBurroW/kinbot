import { useState, useEffect } from 'react'
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
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { ModelPicker } from '@/client/components/common/ModelPicker'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Alert, AlertDescription } from '@/client/components/ui/alert'
import { AvatarPickerModal, type AvatarPickerResult } from '@/client/components/kin/AvatarPickerModal'
import { AlertCircle, Camera, Loader2, Trash2 } from 'lucide-react'

interface Model {
  id: string
  name: string
  providerId: string
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
  }) => Promise<{ id: string }>
  // Mode edit
  kin?: KinDetail | null
  onUpdateKin?: (id: string, data: Record<string, string>) => Promise<unknown>
  onDeleteKin?: (id: string) => Promise<void>
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
}: KinFormModalProps) {
  const { t } = useTranslation()

  const isEdit = !!kin
  const defaultCharacter = t('kin.defaults.character')
  const defaultExpertise = t('kin.defaults.expertise')

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [role, setRole] = useState('')
  const [character, setCharacter] = useState(defaultCharacter)
  const [expertise, setExpertise] = useState(defaultExpertise)
  const [model, setModel] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Sync form when kin changes (edit mode) or reset for create mode
  useEffect(() => {
    if (kin) {
      setName(kin.name)
      setSlug(kin.slug)
      setRole(kin.role)
      setCharacter(kin.character)
      setExpertise(kin.expertise)
      setModel(kin.model)
      setAvatarPreview(kin.avatarUrl)
    } else {
      setName('')
      setSlug('')
      setRole('')
      setCharacter(defaultCharacter)
      setExpertise(defaultExpertise)
      setModel('')
      setAvatarPreview(null)
    }
    setAvatarFile(null)
    setError('')
  }, [kin, defaultCharacter, defaultExpertise])

  const handleAvatarConfirm = (result: AvatarPickerResult) => {
    if (result.mode === 'upload') {
      setAvatarFile(result.file)
      setAvatarPreview(result.preview)
    } else {
      // Generated — convert data URL to File synchronously
      const [header, base64] = result.url.split(',')
      const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
      setAvatarFile(new File([bytes], `avatar.${ext}`, { type: mime }))
      setAvatarPreview(result.url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isEdit && onUpdateKin) {
        await onUpdateKin(kin.id, { name, slug, role, character, expertise, model })
        if (avatarFile) await onUploadAvatar(kin.id, avatarFile)
      } else if (onCreateKin) {
        const created = await onCreateKin({ name, role, character, expertise, model })
        if (avatarFile) await onUploadAvatar(created.id, avatarFile)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('common.error'))
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
      const message = err instanceof Error ? err.message : String(err)
      setError(message || t('common.error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const initials = name.slice(0, 2).toUpperCase()

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t('kin.edit.title') : t('kin.create.title')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="max-h-[calc(90vh-8rem)] space-y-4 overflow-y-auto p-1">
            {error && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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
                  {avatarPreview ? (
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
                    <Label htmlFor="kinFormName">{t('kin.create.name')}</Label>
                    <Input
                      id="kinFormName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('kin.create.namePlaceholder')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kinFormRole">{t('kin.create.role')}</Label>
                    <Input
                      id="kinFormRole"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder={t('kin.create.rolePlaceholder')}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('kin.create.model')}</Label>
                    <ModelPicker
                      models={llmModels}
                      value={model}
                      onValueChange={setModel}
                      placeholder={t('kin.create.modelPlaceholder')}
                    />
                  </div>
                </div>
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
              <Label>{t('kin.create.character')}</Label>
              <MarkdownEditor
                value={character}
                onChange={setCharacter}
                height="180px"
              />
            </div>

            {/* Expertise */}
            <div className="space-y-2">
              <Label>{t('kin.create.expertise')}</Label>
              <MarkdownEditor
                value={expertise}
                onChange={setExpertise}
                height="180px"
              />
            </div>

            {/* Actions */}
            {isEdit ? (
              <div className="flex items-center justify-between pt-2">
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
              <Button
                type="submit"
                disabled={isLoading || !name || !role || !model}
                className="btn-shine w-full"
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
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Avatar picker modal */}
      <AvatarPickerModal
        open={showAvatarPicker}
        onOpenChange={setShowAvatarPicker}
        currentAvatar={isEdit ? kin?.avatarUrl ?? null : null}
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
