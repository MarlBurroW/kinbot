import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookUser, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/client/lib/api'
import { cn } from '@/client/lib/utils'
import { Button } from '@/client/components/ui/button'
import { Card, CardContent } from '@/client/components/ui/card'
import { Input } from '@/client/components/ui/input'
import { PasswordInput } from '@/client/components/ui/password-input'
import { Label } from '@/client/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { EmptyState } from '@/client/components/common/EmptyState'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import { useContactsAccounts, type ContactsAccount, type ContactsProviderInfo } from '@/client/hooks/useContactsAccounts'

export function AddressBookSettings() {
  const { t } = useTranslation()
  const { accounts, providers, isLoading, refetch } = useContactsAccounts()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('settings.addressBook.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('settings.addressBook.subtitle')}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={providers.length === 0}>
          <Plus className="size-4" />
          {t('settings.addressBook.add')}
        </Button>
      </div>

      <HelpPanel contentKey="settings.addressBook.help.content" />

      {isLoading ? (
        <SettingsListSkeleton />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={BookUser}
          title={t('settings.addressBook.emptyTitle')}
          description={t('settings.addressBook.emptyDescription')}
        />
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} onChange={refetch} />
          ))}
        </div>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} providers={providers} onChange={refetch} />
    </div>
  )
}

function AccountCard({ account, onChange }: { account: ContactsAccount; onChange: () => void }) {
  const { t } = useTranslation()

  const disconnect = async () => {
    try {
      await api.delete(`/contacts-accounts/${account.id}`)
      toast.success(t('settings.addressBook.disconnected'))
      onChange()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <ProviderIcon providerType={account.type} variant="color" className="size-5" />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-card',
                account.isValid ? 'bg-emerald-500' : 'bg-destructive',
              )}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{account.accountLabel}</p>
            <p className="truncate text-xs text-muted-foreground">
              {account.name}
              {account.lastError ? ` · ${account.lastError}` : ''}
            </p>
          </div>
        </div>
        <ConfirmDeleteButton
          onConfirm={() => void disconnect()}
          title={t('settings.addressBook.disconnect')}
          description={t('settings.addressBook.disconnectConfirm')}
        />
      </CardContent>
    </Card>
  )
}

function AddDialog({
  open,
  onOpenChange,
  providers,
  onChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  providers: ContactsProviderInfo[]
  onChange: () => void
}) {
  const { t } = useTranslation()
  const [type, setType] = useState<string>('')

  useEffect(() => {
    if (open && providers[0]) setType((prev) => prev || providers[0]!.type)
  }, [open, providers])

  const provider = providers.find((p) => p.type === type) ?? providers[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.addressBook.addTitle')}</DialogTitle>
          <DialogDescription>{t('settings.addressBook.addDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.addressBook.provider')}</Label>
            <Select value={provider?.type ?? ''} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('settings.addressBook.provider')} />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.type} value={p.type}>
                    <span className="flex items-center gap-2">
                      <ProviderIcon providerType={p.type} variant="color" className="size-4" />
                      {p.displayName}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {provider && (
            <ConnectStep provider={provider} onChange={onChange} onClose={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConnectStep({
  provider,
  onChange,
  onClose,
}: {
  provider: ContactsProviderInfo
  onChange: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [connecting, setConnecting] = useState(false)
  const [fields, setFields] = useState<Record<string, string>>({})

  useEffect(() => {
    setFields({})
  }, [provider.type])

  const connect = async () => {
    setConnecting(true)
    try {
      await api.post(`/contacts-accounts/connect-config/${provider.type}`, { fields })
      toast.success(t('settings.addressBook.connected', { provider: provider.displayName }))
      onChange()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setConnecting(false)
    }
  }

  const missingRequired = provider.configSchema.some((f) => f.required && !fields[f.key]?.trim())

  return (
    <div className="space-y-3">
      {provider.consoleUrl && (
        <a
          href={provider.consoleUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline"
        >
          {t('settings.addressBook.credentialsLink', { provider: provider.displayName })}
        </a>
      )}
      {provider.configSchema.map((field) => {
        const isSecret = field.type === 'secret'
        const Tag = isSecret ? PasswordInput : Input
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`ab-${field.key}`} className="text-xs">
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Tag
              id={`ab-${field.key}`}
              value={fields[field.key] ?? ''}
              placeholder={'placeholder' in field ? field.placeholder : undefined}
              onChange={(e) => setFields((v) => ({ ...v, [field.key]: e.target.value }))}
            />
            {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
          </div>
        )
      })}
      <Button className="w-full" onClick={connect} disabled={connecting || missingRequired}>
        <Plus className="size-4" />
        {t('settings.addressBook.connect', { provider: provider.displayName })}
      </Button>
    </div>
  )
}
