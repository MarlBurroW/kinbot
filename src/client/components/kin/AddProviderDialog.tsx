import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select'
import { Alert, AlertDescription } from '@/client/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import { api, getErrorMessage } from '@/client/lib/api'
import { PROVIDER_CAPABILITIES, PROVIDER_DISPLAY_NAMES, PROVIDER_TYPES, PROVIDERS_WITHOUT_API_KEY } from '@/shared/constants'
import type { ProviderType } from '@/shared/types'

interface EditProvider {
  id: string
  name: string
  type: string
}

interface ProviderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  /** Pass a provider to enter edit mode */
  provider?: EditProvider | null
  /** Filter which provider types to show (defaults to all) */
  providerTypes?: readonly string[]
}

export function ProviderFormDialog({ open, onOpenChange, onSaved, provider, providerTypes }: ProviderFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!provider
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testPassed, setTestPassed] = useState(false)
  const [error, setError] = useState('')

  const types = providerTypes ?? PROVIDER_TYPES
  const defaultType = types[0] ?? PROVIDER_TYPES[0]
  const [providerType, setProviderType] = useState<string>(defaultType)
  const [providerName, setProviderName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // Populate form when editing
  useEffect(() => {
    if (open && provider) {
      setProviderType(provider.type)
      setProviderName(provider.name)
      setApiKey('')
      setBaseUrl('')
      setError('')
      setTestPassed(false)
    } else if (open && !provider) {
      resetForm()
    }
  }, [open, provider])

  const resetForm = () => {
    setProviderType(defaultType)
    setProviderName('')
    setApiKey('')
    setBaseUrl('')
    setError('')
    setTestPassed(false)
    setIsTesting(false)
    setIsSaving(false)
    setShowApiKey(false)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const resetTest = () => {
    setTestPassed(false)
    setError('')
  }

  const getCapabilitiesForType = (type: string): readonly string[] => {
    return PROVIDER_CAPABILITIES[type as ProviderType] ?? []
  }

  const isApiKeyOptional = (PROVIDERS_WITHOUT_API_KEY as readonly string[]).includes(providerType)

  const handleTestConnection = async () => {
    setError('')
    setIsTesting(true)
    setTestPassed(false)

    try {
      const config: Record<string, string> = {}
      if (apiKey) config.apiKey = apiKey
      if (baseUrl) config.baseUrl = baseUrl

      // For edit mode without new apiKey, test the existing provider
      if (isEditing && !apiKey) {
        const result = await api.post<{ valid: boolean; error?: string }>(`/providers/${provider!.id}/test`)
        if (result.valid) {
          setTestPassed(true)
        } else {
          setError(result.error || t('onboarding.providers.testFailed'))
        }
        return
      }

      const result = await api.post<{ valid: boolean; error?: string }>('/providers/test', {
        type: providerType,
        config,
      })

      if (result.valid) {
        setTestPassed(true)
      } else {
        setError(result.error || t('onboarding.providers.testFailed'))
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('onboarding.providers.testFailed'))
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)

    try {
      if (isEditing) {
        const body: Record<string, unknown> = {}
        if (providerName !== provider!.name) body.name = providerName || provider!.type
        const config: Record<string, string> = {}
        if (apiKey) config.apiKey = apiKey
        if (baseUrl) config.baseUrl = baseUrl
        if (Object.keys(config).length > 0) body.config = config
        if (providerName !== provider!.name || Object.keys(config).length > 0) {
          await api.patch(`/providers/${provider!.id}`, body)
        }
      } else {
        const config: Record<string, string> = {}
        if (apiKey) config.apiKey = apiKey
        if (baseUrl) config.baseUrl = baseUrl
        await api.post('/providers', {
          name: providerName || (PROVIDER_DISPLAY_NAMES[providerType] ?? providerType),
          type: providerType,
          config,
        })
      }

      onSaved()
      handleClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err) || t('onboarding.providers.testFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  // In edit mode, the user can save name-only changes without re-testing
  const nameChanged = isEditing && providerName !== provider!.name
  const configChanged = !!apiKey || !!baseUrl
  const canSaveWithoutTest = isEditing && nameChanged && !configChanged
  const canSave = testPassed || canSaveWithoutTest

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('settings.providers.edit') : t('onboarding.providers.addProvider')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('settings.providers.editHint') : t('onboarding.providers.addProviderHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive" className="animate-scale-in">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {testPassed && (
            <Alert className="animate-scale-in border-primary/30 bg-primary/5 text-primary">
              <CheckCircle2 className="size-4" />
              <AlertDescription>{t('onboarding.providers.testSuccess')}</AlertDescription>
            </Alert>
          )}

          {!isEditing && types.length > 1 && (
            <div className="space-y-2">
              <Label>{t('onboarding.providers.type')}</Label>
              <Select value={providerType} onValueChange={(v) => {
                setProviderType(v)
                setProviderName('')
                setBaseUrl('')
                resetTest()
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className="flex items-center gap-2">
                        <ProviderIcon providerType={type} className="size-4 shrink-0" />
                        <span>{PROVIDER_DISPLAY_NAMES[type] ?? type}</span>
                        <span className="text-xs text-muted-foreground">
                          ({getCapabilitiesForType(type).join(', ')})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="providerName">
              {t('onboarding.providers.name')}
              <span className="ml-1 text-xs text-muted-foreground">
                ({t('common.optional')})
              </span>
            </Label>
            <Input
              id="providerName"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder={t('onboarding.providers.namePlaceholder', { type: PROVIDER_DISPLAY_NAMES[providerType] ?? providerType })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">
              {isApiKeyOptional ? t('onboarding.providers.credentialsPath') : t('onboarding.providers.apiKey')}
              {(isEditing || isApiKeyOptional) && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({isApiKeyOptional ? t('onboarding.providers.credentialsPathHint') : t('onboarding.providers.apiKeyEditHint')})
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={isApiKeyOptional ? 'text' : showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); resetTest() }}
                autoComplete="off"
                placeholder={isApiKeyOptional ? '~/.claude/.credentials.json' : isEditing ? '••••••••' : undefined}
                className={!isApiKeyOptional ? 'pr-9' : undefined}
              />
              {!isApiKeyOptional && (
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={t(showApiKey ? 'onboarding.providers.hideApiKey' : 'onboarding.providers.showApiKey')}
                  aria-label={t(showApiKey ? 'onboarding.providers.hideApiKey' : 'onboarding.providers.showApiKey')}
                >
                  {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseUrl">
              {t('onboarding.providers.baseUrl')}
              <span className="ml-1 text-xs text-muted-foreground">
                ({t('common.optional')})
              </span>
            </Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => { setBaseUrl(e.target.value); resetTest() }}
              placeholder={t('onboarding.providers.baseUrlHint')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            {!canSave ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={isTesting || (!isEditing && !isApiKeyOptional && !apiKey)}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('onboarding.providers.testing')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    {t('onboarding.providers.test')}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-shine"
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isEditing ? (
                  t('common.save')
                ) : (
                  t('onboarding.providers.add')
                )}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** @deprecated Use ProviderFormDialog instead */
export const AddProviderDialog = ProviderFormDialog
