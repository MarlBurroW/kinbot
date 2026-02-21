import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SidebarTrigger } from '@/client/components/ui/sidebar'
import { Separator } from '@/client/components/ui/separator'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/ui/avatar'
import { Alert, AlertDescription } from '@/client/components/ui/alert'
import { Camera, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '@/client/hooks/useAuth'
import { api } from '@/client/lib/api'

export function AccountPage() {
  const { t } = useTranslation()
  const { user, refetch } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [pseudonym, setPseudonym] = useState(user?.pseudonym ?? '')
  const [language, setLanguage] = useState(user?.language ?? 'en')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl ?? null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '')
      setLastName(user.lastName ?? '')
      setPseudonym(user.pseudonym ?? '')
      setLanguage(user.language ?? 'en')
      setAvatarPreview(user.avatarUrl)
    }
  }, [user])

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
    setSaved(false)

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
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false)
    }
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  return (
    <>
      {/* Header */}
      <header className="surface-header sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <h2 className="text-sm font-medium">{t('account.title')}</h2>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-md">
          <p className="mb-6 text-sm text-muted-foreground">
            {t('account.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {saved && (
              <Alert className="animate-scale-in border-success/30 bg-success/10">
                <CheckCircle2 className="size-4 text-success" />
                <AlertDescription className="text-success">{t('account.saved')}</AlertDescription>
              </Alert>
            )}

            {/* Avatar */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative"
              >
                <Avatar className="size-20 ring-2 ring-border transition-all group-hover:ring-primary">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt="Avatar" />
                  ) : (
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-5 text-white" />
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acctFirstName">{t('account.firstName')}</Label>
                <Input
                  id="acctFirstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acctLastName">{t('account.lastName')}</Label>
                <Input
                  id="acctLastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acctPseudonym">{t('account.pseudonym')}</Label>
              <Input
                id="acctPseudonym"
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('account.language')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="btn-shine w-full"
              size="lg"
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
          </form>
        </div>
      </div>
    </>
  )
}
