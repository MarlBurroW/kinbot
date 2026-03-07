import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { api, getErrorMessage } from '@/client/lib/api'
import { Skeleton } from '@/client/components/ui/skeleton'
import { InfoTip } from '@/client/components/common/InfoTip'
import { HelpPanel } from '@/client/components/common/HelpPanel'

export function GeneralSettings() {
  const { t } = useTranslation()

  const [isLoading, setIsLoading] = useState(true)

  // Global prompt
  const [globalPrompt, setGlobalPrompt] = useState('')
  const [initialGlobalPrompt, setInitialGlobalPrompt] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)

  // Hub Kin
  const [hubKinId, setHubKinId] = useState<string | null>(null)
  const [allKins, setAllKins] = useState<{ id: string; name: string }[]>([])
  const [savingHub, setSavingHub] = useState(false)

  useEffect(() => {
    Promise.all([fetchGlobalPrompt(), fetchHubKin()])
  }, [])

  const fetchHubKin = async () => {
    try {
      const [hubData, kinsData] = await Promise.all([
        api.get<{ hubKinId: string | null }>('/settings/hub'),
        api.get<{ kins: { id: string; name: string }[] }>('/kins'),
      ])
      setHubKinId(hubData.hubKinId)
      setAllKins(kinsData.kins)
    } catch {
      // Ignore
    }
  }

  const handleHubChange = async (kinId: string) => {
    setSavingHub(true)
    try {
      await api.put('/settings/hub', { kinId })
      setHubKinId(kinId)
      toast.success(t('settings.general.hubSaved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingHub(false)
    }
  }

  const fetchGlobalPrompt = async () => {
    try {
      const data = await api.get<{ globalPrompt: string }>('/settings/global-prompt')
      setGlobalPrompt(data.globalPrompt)
      setInitialGlobalPrompt(data.globalPrompt)
    } catch {
      // Ignore — will show empty
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePrompt = async () => {
    setSavingPrompt(true)
    try {
      await api.put('/settings/global-prompt', { globalPrompt })
      setInitialGlobalPrompt(globalPrompt)
      toast.success(t('settings.general.saved'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingPrompt(false)
    }
  }

  const hasPromptChanges = globalPrompt !== initialGlobalPrompt
  const approxTokens = Math.ceil(globalPrompt.length / 4)

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
          <Select
            value={hubKinId ?? ''}
            onValueChange={handleHubChange}
            disabled={savingHub}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder={t('settings.general.hubKinPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {allKins.map((kin) => (
                <SelectItem key={kin.id} value={kin.id}>
                  {kin.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <p className="text-xs text-muted-foreground tabular-nums">
            ~{approxTokens} tokens
          </p>
        </div>
      </div>

      <Button
        onClick={handleSavePrompt}
        disabled={!hasPromptChanges || savingPrompt}
      >
        {savingPrompt ? t('common.loading') : t('common.save')}
      </Button>

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
