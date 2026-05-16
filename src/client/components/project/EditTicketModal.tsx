import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/client/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/client/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { Label } from '@/client/components/ui/label'
import { getErrorMessage } from '@/client/lib/api'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { TICKET_STATUSES } from '@/shared/constants'
import type { ProjectTag, Ticket, TicketStatus } from '@/shared/types'
import { useTicketComments } from '@/client/hooks/useTicketComments'
import { useAuth } from '@/client/hooks/useAuth'
import { TicketCommentsList } from '@/client/components/project/TicketCommentsList'
import { TicketCommentForm } from '@/client/components/project/TicketCommentForm'

interface EditTicketModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: Ticket
  availableTags: ProjectTag[]
  onSave: (input: {
    title?: string
    description?: string
    status?: TicketStatus
    tagIds?: string[]
  }) => Promise<unknown>
  onDelete: () => Promise<void>
}

export function EditTicketModal({ open, onOpenChange, ticket, availableTags, onSave, onDelete }: EditTicketModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(ticket.tags.map((tg) => tg.id))
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Only subscribe / fetch comments while the modal is open to avoid a network
  // hit on every list render where a ticket card mounts the modal lazily.
  const { comments, isLoading: commentsLoading, createComment, updateComment, deleteComment } =
    useTicketComments(open ? ticket.id : null)

  // Reset fields whenever the modal (re)opens or the ticket changes
  useEffect(() => {
    if (open) {
      setTitle(ticket.title)
      setDescription(ticket.description)
      setStatus(ticket.status)
      setSelectedTagIds(ticket.tags.map((tg) => tg.id))
    }
  }, [open, ticket])

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  const currentTagIds = ticket.tags.map((tg) => tg.id).sort().join(',')
  const draftTagIds = [...selectedTagIds].sort().join(',')
  const hasChanges =
    title !== ticket.title ||
    description !== ticket.description ||
    status !== ticket.status ||
    draftTagIds !== currentTagIds

  async function handleSave() {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    setSubmitting(true)
    try {
      await onSave({
        title: trimmedTitle !== ticket.title ? trimmedTitle : undefined,
        description: description !== ticket.description ? description : undefined,
        status: status !== ticket.status ? status : undefined,
        tagIds: draftTagIds !== currentTagIds ? selectedTagIds : undefined,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete()
      setDeleteOpen(false)
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {ticket.number !== null && ticket.number !== undefined && (
                <span
                  className="font-mono text-xs font-normal text-muted-foreground"
                  aria-label={`Ticket #${ticket.number}`}
                >
                  #{ticket.number}
                </span>
              )}
              <span>{t('projects.ticket.edit.title')}</span>
            </DialogTitle>
            <DialogDescription>{t('projects.ticket.edit.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-ticket-title">{t('projects.ticket.create.titleField')}</Label>
              <Input
                id="edit-ticket-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-ticket-status">{t('projects.ticket.panel.status')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                <SelectTrigger id="edit-ticket-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`projects.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t('projects.ticket.create.descriptionField')}</Label>
              <MarkdownEditor
                value={description}
                onChange={setDescription}
                height="240px"
              />
            </div>

            {availableTags.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t('projects.ticket.create.tagsField')}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                          selected
                            ? 'border-transparent'
                            : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                        )}
                        style={
                          selected
                            ? {
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                                borderColor: `${tag.color}40`,
                              }
                            : undefined
                        }
                      >
                        {tag.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-border/60">
              <Label>{t('projects.ticket.comments.title')}</Label>
              <TicketCommentsList
                comments={comments}
                isLoading={commentsLoading}
                currentUserId={user?.id ?? null}
                onUpdate={(commentId, content) => updateComment(commentId, content)}
                onDelete={(commentId) => deleteComment(commentId)}
              />
              {user && (
                <TicketCommentForm
                  onSubmit={(content) => createComment(content)}
                />
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={submitting}
            >
              <Trash2 className="mr-1 size-4" />
              {t('projects.ticket.panel.delete')}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || !title.trim() || submitting}>
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.ticket.panel.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.ticket.panel.deleteConfirm.description', { title: ticket.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t('common.loading') : t('projects.ticket.panel.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
