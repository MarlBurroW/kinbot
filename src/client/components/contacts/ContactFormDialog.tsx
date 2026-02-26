import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/client/components/ui/popover'
import { AlertCircle, Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import { api, getErrorMessage } from '@/client/lib/api'
import { CONTACT_IDENTIFIER_SUGGESTIONS } from '@/shared/constants'
import type { ContactData } from '@/client/components/contacts/ContactCard'

interface UserOption {
  id: string
  name: string
  pseudonym: string
}

interface IdentifierRow {
  existingId?: string
  label: string
  value: string
}

interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  contact?: ContactData | null
}

function LabelCombo({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = CONTACT_IDENTIFIER_SUGGESTIONS.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase()),
  )

  const normalizedSearch = search.trim().toLowerCase()
  const showCustom = normalizedSearch !== '' &&
    !CONTACT_IDENTIFIER_SUGGESTIONS.includes(normalizedSearch as typeof CONTACT_IDENTIFIER_SUGGESTIONS[number])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-36 shrink-0 justify-between px-2 text-xs font-normal"
        >
          <span className="truncate">{value || '...'}</span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0" align="start">
        <div className="border-b px-2 py-1.5">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                onChange(search.trim())
                setSearch('')
                setOpen(false)
              }
            }}
            placeholder={t('settings.contacts.typeOrSearch')}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-40 overflow-y-auto p-1">
          {suggestions.map((s) => (
            <button
              key={s}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(s)
                setSearch('')
                setOpen(false)
              }}
            >
              {value === s ? <Check className="size-3" /> : <span className="size-3" />}
              {s}
            </button>
          ))}
          {showCustom && (
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-xs text-primary hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(search.trim())
                setSearch('')
                setOpen(false)
              }}
            >
              <Plus className="size-3" />
              {search.trim()}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ContactFormDialog({
  open,
  onOpenChange,
  onSaved,
  contact,
}: ContactFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!contact

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'human' | 'kin'>('human')
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null)
  const [users, setUsers] = useState<UserOption[]>([])
  const [identifiers, setIdentifiers] = useState<IdentifierRow[]>([])

  useEffect(() => {
    if (open) {
      api.get<{ users: UserOption[] }>('/users')
        .then((data) => setUsers(data.users))
        .catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (open && contact) {
      setName(contact.name)
      setType(contact.type as 'human' | 'kin')
      setLinkedUserId(contact.linkedUserId ?? null)
      setIdentifiers(
        contact.identifiers.map((i) => ({ existingId: i.id, label: i.label, value: i.value })),
      )
      setError('')
    } else if (open) {
      setName('')
      setType('human')
      setLinkedUserId(null)
      setIdentifiers([])
      setError('')
    }
  }, [open, contact])

  const handleClose = () => {
    onOpenChange(false)
  }

  const addIdentifier = () => {
    setIdentifiers((prev) => [...prev, { label: 'email', value: '' }])
  }

  const removeIdentifier = (index: number) => {
    setIdentifiers((prev) => prev.filter((_, i) => i !== index))
  }

  const updateIdentifier = (index: number, field: 'label' | 'value', val: string) => {
    setIdentifiers((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: val } : row)),
    )
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    try {
      const validIdentifiers = identifiers.filter((i) => i.label && i.value.trim())

      if (isEditing) {
        await api.patch(`/contacts/${contact.id}`, { name, type, linkedUserId })

        // Delete identifiers that were removed from the form
        const currentExistingIds = new Set(validIdentifiers.filter((i) => i.existingId).map((i) => i.existingId))
        for (const orig of contact.identifiers) {
          if (!currentExistingIds.has(orig.id)) {
            await api.delete(`/contacts/${contact.id}/identifiers/${orig.id}`)
          }
        }

        // Update existing identifiers that changed, add new ones
        for (const ident of validIdentifiers) {
          if (ident.existingId) {
            const orig = contact.identifiers.find((i) => i.id === ident.existingId)
            if (orig && (orig.label !== ident.label || orig.value !== ident.value)) {
              await api.patch(`/contacts/${contact.id}/identifiers/${ident.existingId}`, {
                label: ident.label,
                value: ident.value,
              })
            }
          } else {
            await api.post(`/contacts/${contact.id}/identifiers`, {
              label: ident.label,
              value: ident.value,
            })
          }
        }
      } else {
        await api.post('/contacts', {
          name,
          type,
          linkedUserId: linkedUserId || undefined,
          identifiers: validIdentifiers.length > 0
            ? validIdentifiers.map((i) => ({ label: i.label, value: i.value }))
            : undefined,
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

  const canSave = name.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('settings.contacts.edit') : t('settings.contacts.add')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('settings.contacts.editHint') : t('settings.contacts.addHint')}
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
            <Label htmlFor="contact-name">{t('settings.contacts.name')}</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.contacts.namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-type" className="inline-flex items-center gap-1.5">{t('settings.contacts.type')} <InfoTip content={t('settings.contacts.typeTip')} /></Label>
            <Select value={type} onValueChange={(v) => setType(v as 'human' | 'kin')}>
              <SelectTrigger id="contact-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="human">{t('settings.contacts.typeHuman')}</SelectItem>
                <SelectItem value="kin">{t('settings.contacts.typeKin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'human' && users.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="contact-linked-user" className="inline-flex items-center gap-1.5">{t('settings.contacts.linkToUser')} <InfoTip content={t('settings.contacts.linkToUserTip')} /></Label>
              <Select
                value={linkedUserId ?? '_none'}
                onValueChange={(v) => setLinkedUserId(v === '_none' ? null : v)}
              >
                <SelectTrigger id="contact-linked-user">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t('settings.contacts.noUserLink')}</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.pseudonym})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">{t('settings.contacts.identifiers')} <InfoTip content={t('settings.contacts.identifiersTip')} /></Label>
            <div className="space-y-2">
              {identifiers.map((ident, index) => (
                <div key={index} className="flex items-center gap-2">
                  <LabelCombo
                    value={ident.label}
                    onChange={(v) => updateIdentifier(index, 'label', v)}
                  />
                  <Input
                    value={ident.value}
                    onChange={(e) => updateIdentifier(index, 'value', e.target.value)}
                    placeholder={t('settings.contacts.identifierValuePlaceholder')}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeIdentifier(index)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addIdentifier} className="w-full">
                <Plus className="size-3.5" />
                {t('settings.contacts.addIdentifier')}
              </Button>
            </div>
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
              t('settings.contacts.add')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
