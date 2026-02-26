import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { api, getErrorMessage } from '@/client/lib/api'
import { Upload, Download, File, Loader2 } from 'lucide-react'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import type { VaultAttachmentSummary } from '@/shared/types'

interface VaultAttachmentListProps {
  entryId: string
}

export function VaultAttachmentList({ entryId }: VaultAttachmentListProps) {
  const { t } = useTranslation()
  const [attachments, setAttachments] = useState<VaultAttachmentSummary[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAttachments()
  }, [entryId])

  const fetchAttachments = async () => {
    try {
      const data = await api.get<{ attachments: VaultAttachmentSummary[] }>(`/vault/entries/${entryId}/attachments`)
      setAttachments(data.attachments)
    } catch {
      // Ignore
    }
  }

  const handleUpload = async (file: globalThis.File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/vault/entries/${entryId}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err?.error?.message ?? t('errors.uploadFailed'))
      }
      await fetchAttachments()
      toast.success(t('settings.vault.attachmentUploaded'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.uploadFailed'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownload = async (attachment: VaultAttachmentSummary) => {
    try {
      const response = await fetch(`/api/vault/attachments/${attachment.id}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('settings.vault.attachmentDownloadFailed'))
    }
  }

  const handleDelete = async (attachmentId: string) => {
    try {
      await api.delete(`/vault/attachments/${attachmentId}`)
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
      toast.success(t('settings.vault.attachmentDeleted'))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-2">
      <Label>{t('settings.vault.attachments')}</Label>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <File className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{att.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatSize(att.size)}</span>
              <Button variant="ghost" size="icon-xs" onClick={() => handleDownload(att)}>
                <Download className="size-3.5" />
              </Button>
              <ConfirmDeleteButton
                onConfirm={() => handleDelete(att.id)}
                description={t('settings.vault.deleteAttachmentConfirm')}
              />
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleUpload(file)
          e.target.value = ''
        }}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full"
      >
        {isUploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {t('settings.vault.addAttachment')}
      </Button>
    </div>
  )
}
