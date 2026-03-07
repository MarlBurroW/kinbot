import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Badge } from '@/client/components/ui/badge'
import { Slider } from '@/client/components/ui/slider'
import { LanguageSelector } from '@/client/components/common/LanguageSelector'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Separator } from '@/client/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Calendar, Camera, ChevronDown, ChevronUp, Crop, KeyRound, Loader2, ZoomIn } from 'lucide-react'
import { useAuth } from '@/client/hooks/useAuth'
import { api, getErrorMessage } from '@/client/lib/api'
import { cropImage, type CropArea } from '@/client/lib/crop-image'
import { toast } from 'sonner'

interface AccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const { t, i18n } = useTranslation()
  const { user, refetch } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [pseudonym, setPseudonym] = useState(user?.pseudonym ?? '')
  const [language, setLanguage] = useState<string>(user?.language ?? 'en')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Cropper state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  // Reset form state when dialog opens
  useEffect(() => {
    if (open && user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setPseudonym(user.pseudonym ?? '')
      setLanguage(user.language ?? 'en')
      setAvatarPreview(user.avatarUrl)
      setAvatarFile(null)
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setCropSrc(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setIsCropping(false)
    }
  }, [open, user])

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('account.password.mismatch'))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t('account.password.tooShort'))
      return
    }
    setIsChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? t('account.password.error'))
      }
      toast.success(t('account.password.success'))
      setShowPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('account.password.error'))
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX_SIZE = 2 * 1024 * 1024
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

    if (file.size > MAX_SIZE) {
      toast.error(t('account.avatarTooLarge', 'Avatar must be under 2MB'))
      e.target.value = ''
      return
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t('account.avatarInvalidType', 'Avatar must be PNG, JPEG, GIF, or WebP'))
      e.target.value = ''
      return
    }

    // Open cropper instead of directly setting the file
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    setIsCropping(true)
    try {
      const { file, dataUrl } = await cropImage(cropSrc, croppedAreaPixels)
      setAvatarFile(file)
      setAvatarPreview(dataUrl)
      setCropSrc(null)
    } finally {
      setIsCropping(false)
    }
  }

  const handleCropCancel = () => {
    setCropSrc(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await api.patch('/me', { firstName, lastName, pseudonym, language })

      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)
        const avatarRes = await fetch('/api/me/avatar', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
        if (!avatarRes.ok) {
          const body = await avatarRes.json().catch(() => null) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? `Avatar upload failed (${avatarRes.status})`)
        }
        setAvatarFile(null)
      }

      await refetch()
      if (language !== i18n.language) {
        await i18n.changeLanguage(language)
      }
      onOpenChange(false)
      toast.success(t('account.saved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const initials = `${(firstName ?? '?').charAt(0)}${(lastName ?? '?').charAt(0)}`.toUpperCase()
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogTitle className="sr-only">{t('account.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('account.subtitle')}</DialogDescription>

        {/* Hero header */}
        <div className="relative flex flex-col items-center px-6 pt-8 pb-5">
          {/* Gradient background band */}
          <div className="absolute inset-x-0 top-0 h-20 gradient-subtle rounded-t-2xl" />

          {/* Cropper overlay */}
          {cropSrc ? (
            <div className="z-10 flex w-full flex-col gap-3">
              <div className="relative h-64 w-full overflow-hidden rounded-lg bg-muted">
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="flex items-center gap-3 px-1">
                <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
                <Slider
                  min={1}
                  max={3}
                  step={0.05}
                  value={[zoom]}
                  onValueChange={([v]) => v !== undefined && setZoom(v)}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={handleCropCancel}>
                  {t('common.cancel')}
                </Button>
                <Button type="button" className="btn-shine flex-1" onClick={handleCropConfirm} disabled={isCropping}>
                  {isCropping ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Crop className="size-4" />
                  )}
                  {t('kin.avatar.cropConfirm')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Avatar className="size-24 shadow-lg transition-shadow group-hover:shadow-[0_0_0_4px_hsl(var(--color-primary)/0.5)]">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt="Avatar" />
                  ) : (
                    <AvatarFallback className="text-2xl font-semibold">{initials}</AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-6 text-white" />
                </div>
              </button>

              {/* User info */}
              <div className="mt-3 flex flex-col items-center gap-1 z-10">
                {displayName && (
                  <h3 className="text-lg font-semibold">{displayName}</h3>
                )}
                {user?.email && (
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                )}
                {user?.role === 'admin' && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {t('account.role.admin')}
                  </Badge>
                )}
                {user?.createdAt && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    {t('account.memberSince', { date: new Date(user.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }) })}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />

        <Separator />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-6 py-5 space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acctFirstName">{t('account.firstName')}</Label>
                <Input
                  id="acctFirstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acctLastName">{t('account.lastName')}</Label>
                <Input
                  id="acctLastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acctPseudonym">{t('account.pseudonym')}</Label>
              <Input
                id="acctPseudonym"
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('account.language')}</Label>
              <LanguageSelector value={language} onValueChange={setLanguage} />
            </div>

            {/* Password change section */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <KeyRound className="size-4" />
                {t('account.password.change')}
                {showPassword ? <ChevronUp className="size-4 ml-auto" /> : <ChevronDown className="size-4 ml-auto" />}
              </button>

              {showPassword && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword">{t('account.password.current')}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">{t('account.password.new')}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">{t('account.password.confirm')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('common.loading')}
                      </>
                    ) : (
                      t('account.password.update')
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <DialogFooter className="px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t('account.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-shine"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('account.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
