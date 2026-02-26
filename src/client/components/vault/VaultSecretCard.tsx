import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { KinBadge } from '@/client/components/common/KinBadge'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import {
  Pencil,
  KeyRound,
  Globe,
  CreditCard,
  StickyNote,
  UserSquare,
  Star,
  Paperclip,
  ShieldCheck,
} from 'lucide-react'
import type { VaultEntryType } from '@/shared/types'

export interface VaultSecretData {
  id: string
  key: string
  description: string | null
  entryType?: string
  isFavorite?: boolean
  attachmentCount?: number
  createdByKinId: string | null
  createdAt: number
  updatedAt: number
}

const TYPE_ICONS: Record<string, typeof KeyRound> = {
  text: KeyRound,
  credential: Globe,
  card: CreditCard,
  note: StickyNote,
  identity: UserSquare,
}

interface VaultSecretCardProps {
  secret: VaultSecretData
  kinName?: string
  kinAvatarUrl?: string | null
  onEdit?: () => void
  onDelete?: () => void
  onToggleFavorite?: () => void
}

export function VaultSecretCard({ secret, kinName, kinAvatarUrl, onEdit, onDelete, onToggleFavorite }: VaultSecretCardProps) {
  const { t } = useTranslation()
  const entryType = secret.entryType ?? 'text'
  const Icon = TYPE_ICONS[entryType] ?? ShieldCheck
  const typeLabel = t(`vault.types.${entryType}`, entryType)

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <Icon className="size-5 text-warning" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium font-mono truncate">{secret.key}</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                {typeLabel}
              </Badge>
              {(secret.attachmentCount ?? 0) > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                  <Paperclip className="size-3" />
                  {secret.attachmentCount}
                </span>
              )}
              {secret.createdByKinId && kinName ? (
                <KinBadge name={kinName} avatarUrl={kinAvatarUrl} />
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                  {t('settings.vault.createdByAdmin')}
                </Badge>
              )}
            </div>
            {secret.description && (
              <p className="text-xs text-muted-foreground truncate">{secret.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleFavorite && (
            <Button variant="ghost" size="icon-xs" onClick={onToggleFavorite}>
              <Star className={`size-3.5 ${secret.isFavorite ? 'fill-warning text-warning' : ''}`} />
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <ConfirmDeleteButton
              onConfirm={onDelete}
              description={t('settings.vault.deleteConfirm')}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
