import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { PasswordInput } from '@/client/components/ui/password-input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Alert, AlertDescription } from '@/client/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { AlertCircle, Loader2 } from 'lucide-react'
import { api, getErrorMessage } from '@/client/lib/api'
import type { VaultSecretData } from '@/client/components/vault/VaultSecretCard'

interface VaultSecretFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  secret?: VaultSecretData | null
}

export function VaultSecretFormDialog({
  open,
  onOpenChange,
  onSaved,
  secret,
}: VaultSecretFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!secret

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open && secret) {
      setKey(secret.key)
      setValue('')
      setDescription(secret.description ?? '')
      setError('')
    } else if (open) {
      setKey('')
      setValue('')
      setDescription('')
      setError('')
    }
  }, [open, secret])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    try {
      if (isEditing) {
        const body: Record<string, string> = {}
        if (value) body.value = value
        if (description !== (secret.description ?? '')) body.description = description
        if (Object.keys(body).length > 0) {
          await api.patch(`/vault/${secret.id}`, body)
        }
      } else {
        await api.post('/vault', {
          key,
          value,
          ...(description ? { description } : {}),
        })
      }
      onSaved()
      handleClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = isEditing ? true : key.trim() !== '' && value.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('settings.vault.edit') : t('settings.vault.add')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('settings.vault.editHint') : t('settings.vault.addHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="vault-key">{t('settings.vault.key')}</Label>
            <Input
              id="vault-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('settings.vault.keyPlaceholder')}
              disabled={isEditing}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vault-value">
              {t('settings.vault.value')}
              {isEditing && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({t('settings.vault.valueEditHint')})
                </span>
              )}
            </Label>
            <PasswordInput
              id="vault-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isEditing ? '••••••••' : t('settings.vault.valuePlaceholder')}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vault-description">
              {t('settings.vault.descriptionLabel')}
              <span className="ml-1 text-xs text-muted-foreground">
                ({t('common.optional')})
              </span>
            </Label>
            <Input
              id="vault-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('settings.vault.descriptionPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="btn-shine"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEditing ? (
              t('common.save')
            ) : (
              t('settings.vault.add')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
