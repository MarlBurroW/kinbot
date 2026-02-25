import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { Card, CardContent } from '@/client/components/ui/card'
import { Textarea } from '@/client/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { PlatformIcon } from '@/client/components/common/PlatformIcon'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { Pencil, Trash2, User, Bot, Globe, Lock, Plus, Check, X } from 'lucide-react'
import { api } from '@/client/lib/api'
import type { ContactPlatformId } from '@/shared/types'

export interface ContactIdentifierData {
  id: string
  label: string
  value: string
}

export interface ContactNoteData {
  id: string
  kinId: string
  scope: string
  content: string
  createdAt: string | number
  updatedAt: string | number
}

export interface ContactData {
  id: string
  name: string
  type: 'human' | 'kin'
  linkedUserId: string | null
  linkedKinId: string | null
  linkedUserName: string | null
  identifiers: ContactIdentifierData[]
  notes: ContactNoteData[]
  createdAt: number
  updatedAt: number
}

export interface KinInfo {
  name: string
  avatarUrl: string | null
}

interface ContactCardProps {
  contact: ContactData
  kinInfo?: Map<string, KinInfo>
  onEdit?: () => void
  onDelete?: () => void
  onRefresh?: () => void
}

export function ContactCard({ contact, kinInfo, onEdit, onDelete, onRefresh }: ContactCardProps) {
  const { t } = useTranslation()
  const Icon = contact.type === 'kin' ? Bot : User

  const [platformIds, setPlatformIds] = useState<ContactPlatformId[]>([])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [newNoteKinId, setNewNoteKinId] = useState('')
  const [newNoteScope, setNewNoteScope] = useState<'global' | 'private'>('global')
  const [newNoteContent, setNewNoteContent] = useState('')

  useEffect(() => {
    api
      .get<{ platformIds: ContactPlatformId[] }>(`/contacts/${contact.id}/platform-ids`)
      .then((data) => setPlatformIds(data.platformIds))
      .catch(() => {})
  }, [contact.id])

  const revokePlatformId = async (pidId: string) => {
    try {
      await api.delete(`/contacts/${contact.id}/platform-ids/${pidId}`)
      setPlatformIds((prev) => prev.filter((p) => p.id !== pidId))
      toast.success(t('settings.contacts.platformIdRevoked'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const startEdit = (note: ContactNoteData) => {
    setEditingNoteId(note.id)
    setEditContent(note.content)
  }

  const cancelEdit = () => {
    setEditingNoteId(null)
    setEditContent('')
  }

  const saveEdit = async (noteId: string) => {
    if (!editContent.trim()) return
    try {
      await api.patch(`/contacts/${contact.id}/notes/${noteId}`, { content: editContent.trim() })
      toast.success(t('settings.contacts.noteSaved'))
      cancelEdit()
      onRefresh?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const deleteNote = async (noteId: string) => {
    try {
      await api.delete(`/contacts/${contact.id}/notes/${noteId}`)
      toast.success(t('settings.contacts.noteDeleted'))
      onRefresh?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const startAddNote = () => {
    const firstKinId = kinInfo ? [...kinInfo.keys()][0] : ''
    setNewNoteKinId(firstKinId)
    setNewNoteScope('global')
    setNewNoteContent('')
    setAddingNote(true)
  }

  const cancelAddNote = () => {
    setAddingNote(false)
  }

  const saveNewNote = async () => {
    if (!newNoteKinId || !newNoteContent.trim()) return
    try {
      await api.post(`/contacts/${contact.id}/notes`, {
        kinId: newNoteKinId,
        scope: newNoteScope,
        content: newNoteContent.trim(),
      })
      toast.success(t('settings.contacts.noteAdded'))
      cancelAddNote()
      onRefresh?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  const kinEntries = kinInfo ? [...kinInfo.entries()] : []

  return (
    <Card className="surface-card">
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <Icon className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{contact.name}</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                  {contact.type === 'kin' ? t('settings.contacts.typeKin') : t('settings.contacts.typeHuman')}
                </Badge>
                {contact.linkedUserName && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 gap-1">
                    <User className="size-2.5" />
                    {contact.linkedUserName}
                  </Badge>
                )}
              </div>
              {contact.identifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {contact.identifiers.map((ident) => (
                    <Badge key={ident.id} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                      {ident.label}: {ident.value}
                    </Badge>
                  ))}
                </div>
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
              <ConfirmDeleteButton
                onConfirm={onDelete}
                description={t('settings.contacts.deleteConfirm')}
              />
            )}
          </div>
        </div>

        {platformIds.length > 0 && (
          <div className="ml-8 border-t pt-2 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {t('settings.contacts.platformIds')}
            </p>
            <div className="flex flex-wrap gap-1">
              {platformIds.map((pid) => (
                <Badge key={pid.id} variant="outline" className="text-[10px] px-1.5 py-0 font-normal gap-1 group">
                  <PlatformIcon platform={pid.platform} variant="color" className="size-3" />
                  <span className="capitalize">{pid.platform}</span>: {pid.platformId}
                  <button
                    onClick={() => revokePlatformId(pid.id)}
                    className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(contact.notes.length > 0 || addingNote) && (
          <div className="ml-8 space-y-1.5 border-t pt-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {t('settings.contacts.notes')}
              </p>
              {!addingNote && kinEntries.length > 0 && (
                <Button variant="ghost" size="icon-xs" onClick={startAddNote}>
                  <Plus className="size-3" />
                </Button>
              )}
            </div>
            {contact.notes.map((note) => {
              const kin = kinInfo?.get(note.kinId)
              const kinName = kin?.name ?? '?'
              const isPrivate = note.scope === 'private'
              const ScopeIcon = isPrivate ? Lock : Globe
              const isEditing = editingNoteId === note.id

              return (
                <div key={note.id} className="group flex items-start gap-2 text-xs">
                  {kin?.avatarUrl ? (
                    <img
                      src={kin.avatarUrl}
                      alt={kinName}
                      className="size-5 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <Bot className="size-5 shrink-0 mt-0.5 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-muted-foreground">{kinName}</span>
                      <ScopeIcon className="size-3 text-muted-foreground/60" />
                      {isPrivate && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {t('settings.contacts.notesPrivate')}
                        </span>
                      )}
                      {!isEditing && (
                        <span className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-xs" onClick={() => startEdit(note)}>
                            <Pencil className="size-2.5" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => deleteNote(note.id)}>
                            <Trash2 className="size-2.5" />
                          </Button>
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-1 space-y-1">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="text-xs min-h-[3rem] resize-none"
                          rows={2}
                        />
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon-xs" onClick={cancelEdit}>
                            <X className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => saveEdit(note.id)}
                            disabled={!editContent.trim()}
                          >
                            <Check className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-foreground/80 whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                </div>
              )
            })}

            {addingNote && (
              <div className="space-y-2 rounded-lg border border-dashed p-2">
                <div className="flex items-center gap-2">
                  <Select value={newNoteKinId} onValueChange={setNewNoteKinId}>
                    <SelectTrigger className="h-7 w-36 text-xs">
                      <SelectValue placeholder={t('settings.contacts.noteKinPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {kinEntries.map(([id, info]) => (
                        <SelectItem key={id} value={id}>
                          {info.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newNoteScope} onValueChange={(v) => setNewNoteScope(v as 'global' | 'private')}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">
                        <span className="flex items-center gap-1.5"><Globe className="size-3" />{t('settings.contacts.noteGlobal')}</span>
                      </SelectItem>
                      <SelectItem value="private">
                        <span className="flex items-center gap-1.5"><Lock className="size-3" />{t('settings.contacts.noteScopePrivate')}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder={t('settings.contacts.noteContentPlaceholder')}
                  className="text-xs min-h-[3rem] resize-none"
                  rows={2}
                />
                <div className="flex gap-1 justify-end">
                  <Button variant="ghost" size="icon-xs" onClick={cancelAddNote}>
                    <X className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={saveNewNote}
                    disabled={!newNoteKinId || !newNoteContent.trim()}
                  >
                    <Check className="size-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {contact.notes.length === 0 && !addingNote && kinEntries.length > 0 && (
          <div className="ml-8 border-t pt-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2" onClick={startAddNote}>
              <Plus className="size-3 mr-1" />
              {t('settings.contacts.addNote')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
