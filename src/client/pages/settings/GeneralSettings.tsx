import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { KinSelector } from '@/client/components/common/KinSelector'
import { api, getErrorMessage, toastError } from '@/client/lib/api'
import { Skeleton } from '@/client/components/ui/skeleton'
import { InfoTip } from '@/client/components/common/InfoTip'
import { HelpPanel } from '@/client/components/common/HelpPanel'

export function GeneralSettings() {
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Global prompt
  const [globalPrompt, setGlobalPrompt] = useState('')
  const [initialGlobalPrompt, setInitialGlobalPrompt] = useState('')

  // Hub Kin
  const [hubKinId, setHubKinId] = useState<string | null>(null)
  const [initialHubKinId, setInitialHubKinId] = useState<string | null>(null)
  const [allKins, setAllKins] = useState<{ id: string; name: string; role?: string; avatarUrl?: string | null }[]>([])

  // Saving state (unified)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setFetchError(null)
    Promise.all([fetchGlobalPrompt(), fetchHubKin()]).catch(() => {})
  }, [])

  const fetchHubKin = async () => {
    try {
      const [hubData, kinsData] = await Promise.all([
        api.get<{ hubKinId: string | null }>('/settings/hub'),
        api.get<{ kins: { id: string; name: string; role: string; avatarUrl: string | null }[] }>('/kins'),
      ])
      setHubKinId(hubData.hubKinId)
      setInitialHubKinId(hubData.hubKinId)
      setAllKins(kinsData.kins)
    } catch (err: unknown) {
      setFetchError(getErrorMessage(err))
      toast.error(t('settings.general.fetchError', 'Failed to load settings'))
    }
  }

  const fetchGlobalPrompt = async () => {
    try {
      const data = await api.get<{ globalPrompt: string }>('/settings/global-prompt')
      setGlobalPrompt(data.globalPrompt)
      setInitialGlobalPrompt(data.globalPrompt)
    } catch (err: unknown) {
      setFetchError(getErrorMessage(err))
      toast.error(t('settings.general.fetchError', 'Failed to load settings'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const promises: Promise<unknown>[] = []

      if (hasPromptChanges) {
        promises.push(api.put('/settings/global-prompt', { globalPrompt }))
      }

      if (hasHubChanges) {
        const actualKinId = hubKinId === '__none__' ? null : hubKinId
        promises.push(api.put('/settings/hub', { kinId: actualKinId }))
      }

      await Promise.all(promises)

      if (hasPromptChanges) {
        setInitialGlobalPrompt(globalPrompt)
      }
      if (hasHubChanges) {
        const actualKinId = hubKinId === '__none__' ? null : hubKinId
        setInitialHubKinId(actualKinId)
        setHubKinId(actualKinId)
      }

      toast.success(t('settings.general.saved'))
    } catch (err: unknown) {
      toastError(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setGlobalPrompt(initialGlobalPrompt)
    setHubKinId(initialHubKinId)
  }

  const MAX_PROMPT_LENGTH = 10000
  const hasPromptChanges = globalPrompt !== initialGlobalPrompt
  const effectiveHubKinId = hubKinId === '__none__' ? null : hubKinId
  const hasHubChanges = effectiveHubKinId !== initialHubKinId
  const hasChanges = hasPromptChanges || hasHubChanges
  const approxTokens = Math.ceil(globalPrompt.length / 4)
  const isOverLimit = globalPrompt.length > MAX_PROMPT_LENGTH

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-4 w-3/4" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[240px] w-full rounded-md" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{fetchError}</p>
        <Button variant="outline" onClick={() => {
          setIsLoading(true)
          setFetchError(null)
          Promise.all([fetchGlobalPrompt(), fetchHubKin()]).catch(() => {})
        }}>
          {t('common.retry', 'Retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        {t('settings.general.description')}
      </p>

      {/* Hub Kin selector */}
      {allKins.length > 0 && (
        <div className="space-y-2">
          <Label className="inline-flex items-center gap-1.5">
            {t('settings.general.hubKin')}
            <InfoTip content={t('settings.general.hubKinTip')} />
          </Label>
          <KinSelector
            value={hubKinId ?? '__none__'}
            onValueChange={setHubKinId}
            kins={allKins}
            placeholder={t('settings.general.hubKinPlaceholder')}
            noneLabel={t('settings.general.hubKinNone', 'None')}
            noneValue="__none__"
            triggerClassName="w-full max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.general.hubKinHint')}
          </p>
        </div>
      )}

      {/* Global prompt */}
      <div className="space-y-2">
        <Label htmlFor="global-prompt" className="inline-flex items-center gap-1.5">
          {t('settings.general.globalPrompt')}
          <InfoTip content={t('settings.general.globalPromptTip')} />
        </Label>
        <MarkdownEditor
          value={globalPrompt}
          onChange={setGlobalPrompt}
          height="240px"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('settings.general.globalPromptHint')}
          </p>
          <p className={`text-xs tabular-nums ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {globalPrompt.length.toLocaleString()}/{MAX_PROMPT_LENGTH.toLocaleString()} · ~{approxTokens} tokens
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving || isOverLimit}
        >
          {saving ? t('common.loading') : t('common.save')}
        </Button>
        {hasChanges && (
          <Button
            variant="ghost"
            onClick={handleDiscard}
          >
            {t('common.discard', 'Discard')}
          </Button>
        )}
      </div>

      <HelpPanel
        contentKey="settings.general.help.content"
        bulletKeys={[
          'settings.general.help.bullet1',
        ]}
        storageKey="help.general.open"
      />
    </div>
  )
}
