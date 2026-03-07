import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Badge } from '@/client/components/ui/badge'
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
import { Calendar, Camera, Loader2 } from 'lucide-react'
import { useAuth } from '@/client/hooks/useAuth'
import { api, getErrorMessage } from '@/client/lib/api'
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

  // Reset form state when dialog opens
  useEffect(() => {
    if (open && user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setPseudonym(user.pseudonym ?? '')
      setLanguage(user.language ?? 'en')
      setAvatarPreview(user.avatarUrl)
      setAvatarFile(null)
    }
  }, [open, user])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await api.patch('/me', { firstName, lastName, pseudonym, language })

      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)
        await fetch('/api/me/avatar', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
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

          {/* Avatar */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative z-10"
          >
            <Avatar className="size-24 ring-4 ring-background shadow-lg transition-all group-hover:ring-primary/50">
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />

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
        </div>

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
