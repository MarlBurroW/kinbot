import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { Brain, Globe, Image, Loader2, Pencil, RefreshCw, Search } from 'lucide-react'
import { PROVIDER_DISPLAY_NAMES } from '@/shared/constants'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'

const CAPABILITY_ICONS: Record<string, typeof Brain> = {
  llm: Brain,
  embedding: Search,
  image: Image,
  search: Globe,
}

export interface ProviderData {
  id: string
  name: string
  type: string
  capabilities: string[]
  isValid: boolean
}

interface ProviderCardProps {
  provider: ProviderData
  isTesting?: boolean
  onTest?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function ProviderCard({ provider, isTesting, onTest, onEdit, onDelete }: ProviderCardProps) {
  const { t } = useTranslation()

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <ProviderIcon providerType={provider.type} variant="color" className="size-6" />
            <span
              className={`absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-card ${
                provider.isValid ? 'bg-emerald-500' : 'bg-destructive'
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-medium">{provider.name}</p>
            <p className="text-xs text-muted-foreground">{PROVIDER_DISPLAY_NAMES[provider.type] ?? provider.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {provider.capabilities.map((cap) => {
            const Icon = CAPABILITY_ICONS[cap]
            return (
              <Badge key={cap} variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                {Icon && <Icon className="size-3" />}
                {t(`onboarding.providers.cap_${cap}`, cap)}
              </Badge>
            )
          })}
          {onTest && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <ConfirmDeleteButton
              onConfirm={onDelete}
              title={t('settings.providers.delete')}
              description={t('settings.providers.deleteConfirm')}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
