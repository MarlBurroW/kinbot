import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { KinBadge } from '@/client/components/common/KinBadge'
import { CheckCircle, Pencil, Plug, Trash2 } from 'lucide-react'

export interface McpServerData {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string> | null
  status: string
  createdByKinId: string | null
  createdAt: number
  updatedAt: number
}

interface McpServerCardProps {
  server: McpServerData
  kinName?: string
  kinAvatarUrl?: string | null
  onApprove?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function McpServerCard({ server, kinName, kinAvatarUrl, onApprove, onEdit, onDelete }: McpServerCardProps) {
  const { t } = useTranslation()

  const isPending = server.status === 'pending_approval'
  const envKeys = server.env ? Object.keys(server.env) : []

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <Plug className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{server.name}</p>
              {isPending ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-warning text-warning">
                  {t('settings.mcp.statusPending')}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                  {t('settings.mcp.statusActive')}
                </Badge>
              )}
              {server.createdByKinId && kinName && (
                <KinBadge name={kinName} avatarUrl={kinAvatarUrl} />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {server.command}
              {server.args.length > 0 && ` ${server.args.join(' ')}`}
            </p>
            {envKeys.length > 0 && (
              <p className="text-xs text-muted-foreground/70 truncate font-mono">
                {envKeys.join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isPending && onApprove && (
            <Button variant="outline" size="sm" onClick={onApprove} className="text-xs h-7 px-2">
              <CheckCircle className="size-3.5" />
              {t('settings.mcp.approve')}
            </Button>
          )}
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
