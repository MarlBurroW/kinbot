import { useTranslation } from 'react-i18next'
import { MemoryList } from '@/client/components/memory/MemoryList'

export function MemoriesSettings() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.memories.description')}
        </p>
      </div>
      <MemoryList kinId={null} />
    </div>
  )
}
