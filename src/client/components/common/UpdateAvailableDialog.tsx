import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { ScrollArea } from '@/client/components/ui/scroll-area'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { ArrowUpCircle, Copy, ExternalLink, Download, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import { api, getErrorMessage } from '@/client/lib/api'
import { toast } from 'sonner'
import type { VersionInfo } from '@/shared/types'

interface UpdateAvailableDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionInfo: VersionInfo
  isDocker: boolean
}

const DOCKER_UPDATE_COMMAND = 'docker compose pull && docker compose up -d'

export function UpdateAvailableDialog({
  open,
  onOpenChange,
  versionInfo,
  isDocker,
}: UpdateAvailableDialogProps) {
  const { t } = useTranslation()
  const { copy, copied } = useCopyToClipboard()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async () => {
    setIsUpdating(true)
    try {
      await api.post('/version-check/update')
      toast.success(t('updateAvailable.updateSuccess'))
      // Server will restart in ~2s, reload after a delay
      setTimeout(() => window.location.reload(), 5000)
    } catch (err) {
      toast.error(t('updateAvailable.updateFailed'), {
        description: getErrorMessage(err),
      })
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-0">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <ArrowUpCircle className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{t('updateAvailable.title')}</DialogTitle>
              <DialogDescription>
                {t('updateAvailable.description', {
                  current: versionInfo.currentVersion,
                  latest: versionInfo.latestVersion,
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 py-4">
          <div className="space-y-4 px-1">
            {/* Version badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {t('updateAvailable.current')}: v{versionInfo.currentVersion}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="default" className="text-xs">
                {t('updateAvailable.latest')}: v{versionInfo.latestVersion}
              </Badge>
            </div>

            {/* Release notes */}
            {versionInfo.releaseNotes && (
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  {t('updateAvailable.releaseNotes')}
                </h4>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground overflow-x-auto prose prose-xs prose-neutral dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-pre:bg-muted prose-pre:text-xs prose-pre:overflow-x-auto prose-code:text-xs prose-code:break-all">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {versionInfo.releaseNotes}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Update instructions */}
            <div>
              <h4 className="text-sm font-semibold mb-2">
                {t('updateAvailable.howToUpdate')}
              </h4>

              {isDocker ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {t('updateAvailable.dockerInstructions')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono truncate">
                      {DOCKER_UPDATE_COMMAND}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => copy(DOCKER_UPDATE_COMMAND)}
                    >
                      <Copy className="size-3.5 mr-1" />
                      {copied ? t('common.copied') : t('common.copy')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {t('updateAvailable.nonDockerInstructions')}
                  </p>
                  <Button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        {t('updateAvailable.updating')}
                      </>
                    ) : (
                      <>
                        <Download className="size-4 mr-2" />
                        {t('updateAvailable.updateButton')}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Link to GitHub release */}
            {versionInfo.releaseUrl && (
              <a
                href={versionInfo.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {t('updateAvailable.viewOnGitHub')}
              </a>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
