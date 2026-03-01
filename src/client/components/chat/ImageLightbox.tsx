import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/client/components/ui/dialog'
import { Button } from '@/client/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/client/components/ui/tooltip'
import { Download, X } from 'lucide-react'
import type { MessageFile } from '@/shared/types'

interface ImageLightboxProps {
  file: MessageFile
  onClose: () => void
}

export function ImageLightbox({ file, onClose }: ImageLightboxProps) {
  const { t } = useTranslation()

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[90vw] max-h-[90vh] p-2 sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{file.name}</DialogTitle>
        <DialogDescription className="sr-only">{file.name}</DialogDescription>
        <div className="flex flex-col items-center gap-2">
          <img
            src={file.url}
            alt={file.name}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="max-w-64 truncate">{file.name}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={file.url} download={file.name}>
                  <Button variant="ghost" size="icon" className="size-7">
                    <Download className="size-3.5" />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>{t('chat.downloadFile')}</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
