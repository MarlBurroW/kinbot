import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { api } from '@/client/lib/api'

export function GeneralSettings() {
  const { t } = useTranslation()
  const [globalPrompt, setGlobalPrompt] = useState('')
  const [initialValue, setInitialValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchGlobalPrompt()
  }, [])

  const fetchGlobalPrompt = async () => {
    try {
      const data = await api.get<{ globalPrompt: string }>('/settings/global-prompt')
      setGlobalPrompt(data.globalPrompt)
      setInitialValue(data.globalPrompt)
    } catch {
      // Ignore — will show empty
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/settings/global-prompt', { globalPrompt })
      setInitialValue(globalPrompt)
      toast.success(t('settings.general.saved'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = globalPrompt !== initialValue
  const approxTokens = Math.ceil(globalPrompt.length / 4)

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('settings.general.description')}
      </p>

      <div className="space-y-2">
        <Label htmlFor="global-prompt">
          {t('settings.general.globalPrompt')}
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
        onClick={handleSave}
        disabled={!hasChanges || saving}
      >
        {saving ? t('common.loading') : t('common.save')}
      </Button>
    </div>
  )
}
