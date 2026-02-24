import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { KinBadge } from '@/client/components/common/KinBadge'
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react'

export interface VaultSecretData {
  id: string
  key: string
  description: string | null
  createdByKinId: string | null
  createdAt: number
  updatedAt: number
}

interface VaultSecretCardProps {
  secret: VaultSecretData
  kinName?: string
  kinAvatarUrl?: string | null
  onEdit?: () => void
  onDelete?: () => void
}

export function VaultSecretCard({ secret, kinName, kinAvatarUrl, onEdit, onDelete }: VaultSecretCardProps) {
  const { t } = useTranslation()

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <ShieldCheck className="size-5 text-warning" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium font-mono truncate">{secret.key}</p>
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
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon-xs" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
