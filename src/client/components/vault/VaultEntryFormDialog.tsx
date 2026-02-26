import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { Textarea } from '@/client/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { AlertCircle, Loader2 } from 'lucide-react'
import { api, getErrorMessage } from '@/client/lib/api'
import { VAULT_BUILTIN_TYPES, VAULT_TYPE_META } from '@/shared/constants'
import type { VaultTypeField, VaultTypeSummary } from '@/shared/types'
import type { VaultSecretData } from '@/client/components/vault/VaultSecretCard'
import { VaultAttachmentList } from '@/client/components/vault/VaultAttachmentList'

interface VaultEntryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  entry?: VaultSecretData | null
  customTypes?: VaultTypeSummary[]
}

export function VaultEntryFormDialog({
  open,
  onOpenChange,
  onSaved,
  entry,
  customTypes = [],
}: VaultEntryFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!entry

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [key, setKey] = useState('')
  const [entryType, setEntryType] = useState('text')
  const [description, setDescription] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})

  // Build type options
  const typeOptions = useMemo(() => {
    const options = VAULT_BUILTIN_TYPES.map((type) => ({
      value: type,
      label: t(`vault.types.${type}`, type),
    }))
    for (const ct of customTypes) {
      options.push({ value: ct.slug, label: ct.name })
    }
    return options
  }, [t, customTypes])

  // Get fields for current entry type
  const fields = useMemo((): VaultTypeField[] => {
    const builtIn = VAULT_TYPE_META[entryType as keyof typeof VAULT_TYPE_META]
    if (builtIn) return builtIn.fields
    const custom = customTypes.find((ct) => ct.slug === entryType)
    if (custom) return custom.fields
    return VAULT_TYPE_META.text.fields
  }, [entryType, customTypes])

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return

    if (entry) {
      setKey(entry.key)
      setEntryType(entry.entryType ?? 'text')
      setDescription(entry.description ?? '')
      setFieldValues({})
      setError('')

      // Load current value for editing
      api.get<{ entryType: string; value: string | Record<string, unknown> }>(`/vault/entries/${entry.id}`)
        .then((data) => {
          if (typeof data.value === 'string') {
            setFieldValues({ value: data.value })
          } else if (typeof data.value === 'object' && data.value !== null) {
            const vals: Record<string, string> = {}
            for (const [k, v] of Object.entries(data.value)) {
              vals[k] = String(v ?? '')
            }
            setFieldValues(vals)
          }
        })
        .catch(() => { /* ignore — user will re-enter values */ })
    } else {
      setKey('')
      setEntryType('text')
      setDescription('')
      setFieldValues({})
      setError('')
    }
  }, [open, entry])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }))
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    try {
      // Build value based on entry type
      let value: string | Record<string, unknown>
      if (entryType === 'text') {
        value = fieldValues.value ?? ''
      } else {
        const obj: Record<string, unknown> = {}
        for (const field of fields) {
          if (fieldValues[field.name] !== undefined && fieldValues[field.name] !== '') {
            obj[field.name] = fieldValues[field.name]
          }
        }
        value = obj
      }

      if (isEditing) {
        await api.patch(`/vault/entries/${entry.id}`, {
          value,
          ...(description !== (entry.description ?? '') ? { description } : {}),
        })
      } else {
        await api.post('/vault/entries', {
          key,
          entryType,
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

  // Validate: key required for new entries, at least one required field filled
  const canSave = useMemo(() => {
    if (!isEditing && !key.trim()) return false
    const requiredFields = fields.filter((f) => f.required)
    if (requiredFields.length > 0) {
      // For editing, allow saving even if we haven't loaded values yet (password fields)
      if (!isEditing) {
        return requiredFields.every((f) => (fieldValues[f.name] ?? '').trim() !== '')
      }
    }
    return true
  }, [isEditing, key, fields, fieldValues])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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

          {/* Entry type selector (only for new entries) */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>{t('settings.vault.entryType')}</Label>
              <Select value={entryType} onValueChange={(v) => { setEntryType(v); setFieldValues({}) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Key field */}
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

          {/* Dynamic fields based on entry type */}
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`vault-field-${field.name}`}>
                {field.label}
                {!field.required && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({t('common.optional')})
                  </span>
                )}
                {isEditing && field.type === 'password' && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({t('settings.vault.valueEditHint')})
                  </span>
                )}
              </Label>
              {field.type === 'textarea' ? (
                <Textarea
                  id={`vault-field-${field.name}`}
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                />
              ) : (
                <Input
                  id={`vault-field-${field.name}`}
                  type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                  value={fieldValues[field.name] ?? ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder ?? (isEditing && field.type === 'password' ? '••••••••' : undefined)}
                  autoComplete="off"
                />
              )}
            </div>
          ))}

          {/* Description */}
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

          {/* Attachments (only for existing entries) */}
          {isEditing && entry && (
            <VaultAttachmentList entryId={entry.id} />
          )}
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
