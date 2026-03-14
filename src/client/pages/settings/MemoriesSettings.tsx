import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { MemoryModelConfig } from '@/client/components/common/MemoryModelConfig'
import { HelpPanel } from '@/client/components/common/HelpPanel'
import { MemoryList } from '@/client/components/memory/MemoryList'
import { Label } from '@/client/components/ui/label'
import { Slider } from '@/client/components/ui/slider'
import { api } from '@/client/lib/api'

export function MemoriesSettings() {
  const { t } = useTranslation()
  const [thresholdPercent, setThresholdPercent] = useState(75)
  const [initialThreshold, setInitialThreshold] = useState(75)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ thresholdPercent: number }>('/settings/compacting-threshold')
      .then((data) => {
        setThresholdPercent(data.thresholdPercent)
        setInitialThreshold(data.thresholdPercent)
      })
      .catch(() => { /* use default */ })
      .finally(() => setLoading(false))
  }, [])

  const handleThresholdChange = async (value: number[]) => {
    const newPercent = value[0]!
    setThresholdPercent(newPercent)
  }

  const handleThresholdCommit = async (value: number[]) => {
    const newPercent = value[0]!
    try {
      await api.put('/settings/compacting-threshold', { thresholdPercent: newPercent })
      setInitialThreshold(newPercent)
      toast.success(t('settings.memories.compactingThresholdSaved'))
    } catch {
      setThresholdPercent(initialThreshold)
      toast.error(t('settings.memories.compactingThresholdError'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.memories.description')}
        </p>
      </div>

      {/* Compaction threshold */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            {t('settings.memories.compactingThresholdLabel')}
          </Label>
          <span className="text-sm font-mono text-muted-foreground">{loading ? '...' : `${thresholdPercent}%`}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.memories.compactingThresholdDescription')}
        </p>
        {!loading && (
          <Slider
            value={[thresholdPercent]}
            min={50}
            max={95}
            step={5}
            onValueChange={handleThresholdChange}
            onValueCommit={handleThresholdCommit}
          />
        )}
      </div>

      <MemoryModelConfig variant="settings" />

      <HelpPanel
        contentKey="settings.memories.help.content"
        bulletKeys={[
          'settings.memories.help.bullet1',
          'settings.memories.help.bullet2',
          'settings.memories.help.bullet3',
          'settings.memories.help.bullet4',
        ]}
        storageKey="help.memories.open"
      />

      <MemoryList kinId={null} />
    </div>
  )
}
