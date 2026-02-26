import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { KinBadge } from '@/client/components/common/KinBadge'
import {
  Copy,
  Download,
  Eye,
  Flame,
  HardDrive,
  Lock,
  Pencil,
  Timer,
  Trash2,
  Globe,
} from 'lucide-react'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { toast } from 'sonner'

export interface StoredFileData {
  id: string
  kinId: string
  name: string
  description: string | null
  originalName: string
  mimeType: string
  size: number
  isPublic: boolean
  hasPassword: boolean
  readAndBurn: boolean
  expiresAt: number | null
  downloadCount: number
  url: string
  createdByKinId: string | null
  createdAt: number
  updatedAt: number
}

interface FileStorageCardProps {
  file: StoredFileData
  kinName?: string
  kinAvatarUrl?: string | null
  onEdit?: () => void
  onDelete?: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatExpiry(expiresAt: number): string {
  const now = Date.now()
  const diff = expiresAt - now
  if (diff <= 0) return 'expired'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function FileStorageCard({ file, kinName, kinAvatarUrl, onEdit, onDelete }: FileStorageCardProps) {
  const { t } = useTranslation()

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(file.url)
      toast.success(t('settings.files.urlCopied'))
    } catch {
      toast.error(t('errors.copyFailed'))
    }
  }

  return (
    <Card className="surface-card">
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            <HardDrive className="size-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatFileSize(file.size)}
              </span>
              {file.isPublic ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                  <Globe className="size-2.5" />
                  {t('settings.files.public')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                  <Eye className="size-2.5" />
                  {t('settings.files.private')}
                </Badge>
              )}
              {file.hasPassword && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                  <Lock className="size-2.5" />
                </Badge>
              )}
              {file.readAndBurn && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                  <Flame className="size-2.5" />
                </Badge>
              )}
              {file.expiresAt && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-0.5">
                  <Timer className="size-2.5" />
                  {formatExpiry(file.expiresAt)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {file.description && (
                <p className="text-xs text-muted-foreground truncate">{file.description}</p>
              )}
              <span className="text-[10px] text-muted-foreground shrink-0">
                <Download className="inline size-2.5 mr-0.5" />
                {file.downloadCount}
              </span>
              {file.createdByKinId && kinName && (
                <KinBadge name={kinName} avatarUrl={kinAvatarUrl} />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon-xs" onClick={handleCopyUrl} title={t('settings.files.copyUrl')}>
            <Copy className="size-3.5" />
          </Button>
          {onEdit && (
            <Button variant="ghost" size="icon-xs" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </Button>
          )}
          {onDelete && (
            <ConfirmDeleteButton
              onConfirm={onDelete}
              description={t('settings.files.deleteConfirm')}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
