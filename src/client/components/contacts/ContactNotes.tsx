import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { KinSelector } from '@/client/components/common/KinSelector'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { Pencil, Bot, Globe, Lock, Plus, Check, X, User } from 'lucide-react'
import { api, toastError } from '@/client/lib/api'
import type { ContactNoteData, KinInfo } from './ContactCard'

interface ContactNotesProps {
  contactId: string
  notes: ContactNoteData[]
  kinInfo?: Map<string, KinInfo>
  onRefresh?: () => void
}

export function ContactNotes({ contactId, notes, kinInfo, onRefresh }: ContactNotesProps) {
  const { t } = useTranslation()

  const userNote = notes.find((n) => n.userId !== null)
  const kinNotes = notes.filter((n) => n.userId === null)

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [newNoteKinId, setNewNoteKinId] = useState('')
  const [newNoteScope, setNewNoteScope] = useState<'global' | 'private'>('global')
  const [newNoteContent, setNewNoteContent] = useState('')

  const [editingUserNote, setEditingUserNote] = useState(false)
  const [userNoteDraft, setUserNoteDraft] = useState('')

  const kinEntries = kinInfo ? [...kinInfo.entries()] : []
  const kinOptions = kinEntries.map(([id, info]) => ({ id, name: info.name, avatarUrl: info.avatarUrl }))

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
      await api.patch(`/contacts/${contactId}/notes/${noteId}`, { content: editContent.trim() })
      toast.success(t('settings.contacts.noteSaved'))
      cancelEdit()
      onRefresh?.()
    } catch (err: unknown) {
      toastError(err)
    }
  }

  const deleteNote = async (noteId: string) => {
    try {
      await api.delete(`/contacts/${contactId}/notes/${noteId}`)
      toast.success(t('settings.contacts.noteDeleted'))
      onRefresh?.()
    } catch (err: unknown) {
      toastError(err)
    }
  }

  const startAddNote = () => {
    const firstKinId = kinInfo ? [...kinInfo.keys()][0] ?? '' : ''
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
      await api.post(`/contacts/${contactId}/notes`, {
        kinId: newNoteKinId,
        scope: newNoteScope,
        content: newNoteContent.trim(),
      })
      toast.success(t('settings.contacts.noteAdded'))
      cancelAddNote()
      onRefresh?.()
    } catch (err: unknown) {
      toastError(err)
    }
  }

  const startEditUserNote = () => {
    setUserNoteDraft(userNote?.content ?? '')
    setEditingUserNote(true)
  }

  const cancelEditUserNote = () => {
    setEditingUserNote(false)
    setUserNoteDraft('')
  }

  const saveUserNote = async () => {
    if (!userNoteDraft.trim()) return
    try {
      await api.put(`/contacts/${contactId}/user-note`, { content: userNoteDraft.trim() })
      toast.success(t('settings.contacts.noteSaved'))
      cancelEditUserNote()
      onRefresh?.()
    } catch (err: unknown) {
      toastError(err)
    }
  }

  const deleteUserNote = async () => {
    try {
      await api.delete(`/contacts/${contactId}/user-note`)
      toast.success(t('settings.contacts.noteDeleted'))
      onRefresh?.()
    } catch (err: unknown) {
      toastError(err)
    }
  }

  const hasAnything = kinNotes.length > 0 || userNote || addingNote || editingUserNote

  if (!hasAnything) {
    return (
      <div className="ml-8 border-t pt-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2" onClick={startEditUserNote}>
          <Plus className="size-3 mr-1" />
          {t('settings.contacts.addUserNote')}
        </Button>
        {kinEntries.length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2" onClick={startAddNote}>
            <Plus className="size-3 mr-1" />
            {t('settings.contacts.addNote')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="ml-8 space-y-3 border-t pt-2">
      {/* ─── User note section ─── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <User className="size-2.5" />
            {t('settings.contacts.userNote')}
          </p>
          {!editingUserNote && !userNote && (
            <Button variant="ghost" size="icon-xs" onClick={startEditUserNote}>
              <Plus className="size-3" />
            </Button>
          )}
        </div>

        {editingUserNote ? (
          <div className="space-y-1 rounded-lg border border-dashed p-2">
            <Textarea
              value={userNoteDraft}
              onChange={(e) => setUserNoteDraft(e.target.value)}
              placeholder={t('settings.contacts.userNotePlaceholder')}
              className="text-xs min-h-[3rem] resize-none"
              rows={2}
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="icon-xs" onClick={cancelEditUserNote}>
                <X className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={saveUserNote}
                disabled={!userNoteDraft.trim()}
              >
                <Check className="size-3" />
              </Button>
            </div>
          </div>
        ) : userNote ? (
          <div className="group flex items-start gap-2 text-xs">
            <User className="size-5 shrink-0 mt-0.5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-muted-foreground">{t('settings.contacts.userNote')}</span>
                <span className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon-xs" onClick={startEditUserNote}>
                    <Pencil className="size-2.5" />
                  </Button>
                  <ConfirmDeleteButton
                    onConfirm={deleteUserNote}
                    description={t('settings.contacts.deleteUserNoteConfirm')}
                    iconSize="size-2.5"
                  />
                </span>
              </div>
              <p className="text-foreground/80 whitespace-pre-wrap">{userNote.content}</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ─── Kin notes section ─── */}
      {(kinNotes.length > 0 || addingNote) && (
        <div className="space-y-1.5">
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
          {kinNotes.map((note) => {
            const kin = note.kinId ? kinInfo?.get(note.kinId) : undefined
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
                        <ConfirmDeleteButton
                          onConfirm={() => deleteNote(note.id)}
                          description={t('settings.contacts.deleteNoteConfirm')}
                          iconSize="size-2.5"
                        />
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
                <KinSelector
                  value={newNoteKinId}
                  onValueChange={setNewNoteKinId}
                  kins={kinOptions}
                  placeholder={t('settings.contacts.noteKinPlaceholder')}
                  triggerClassName="h-7 w-36 text-xs"
                  autoHeight={false}
                />
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

      {/* Quick "add Kin note" if section is hidden and we have a user note */}
      {kinNotes.length === 0 && !addingNote && kinEntries.length > 0 && (
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-6 px-2" onClick={startAddNote}>
          <Plus className="size-3 mr-1" />
          {t('settings.contacts.addNote')}
        </Button>
      )}
    </div>
  )
}
