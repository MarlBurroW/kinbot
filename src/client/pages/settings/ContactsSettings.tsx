import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
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
import { Plus , Users} from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { api } from '@/client/lib/api'
import { ContactCard, type ContactData, type KinInfo } from '@/client/components/contacts/ContactCard'
import { ContactFormDialog } from '@/client/components/contacts/ContactFormDialog'

export function ContactsSettings() {
  const { t } = useTranslation()
  const [contacts, setContacts] = useState<ContactData[]>([])
  const [kinInfo, setKinInfo] = useState<Map<string, KinInfo>>(new Map())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactData | null>(null)
  const [deletingContact, setDeletingContact] = useState<ContactData | null>(null)

  useEffect(() => {
    fetchContacts()
    fetchKinInfo()
  }, [])

  const fetchContacts = async () => {
    try {
      const data = await api.get<{ contacts: ContactData[] }>('/contacts')
      setContacts(data.contacts)
    } catch {
      // Ignore
    }
  }

  const fetchKinInfo = async () => {
    try {
      const data = await api.get<{ kins: { id: string; name: string; avatarUrl: string | null }[] }>('/kins')
      setKinInfo(new Map(data.kins.map((k) => [k.id, { name: k.name, avatarUrl: k.avatarUrl }])))
    } catch {
      // Ignore
    }
  }

  const handleDeleteContact = async () => {
    if (!deletingContact) return
    try {
      await api.delete(`/contacts/${deletingContact.id}`)
      await fetchContacts()
      toast.success(t('settings.contacts.deleted'))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setDeletingContact(null)
    }
  }

  const handleSaved = async () => {
    await fetchContacts()
    toast.success(editingContact ? t('settings.contacts.saved') : t('settings.contacts.added'))
  }

  const openAdd = () => {
    setEditingContact(null)
    setModalOpen(true)
  }

  const openEdit = (contact: ContactData) => {
    setEditingContact(contact)
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('settings.contacts.description')}
        </p>
      </div>

      {contacts.length === 0 && (
        <EmptyState
          icon={Users}
          title={t('settings.contacts.empty')}
          description={t('settings.contacts.emptyDescription')}
          actionLabel={t('settings.contacts.add')}
          onAction={openAdd}
        />
      )}

      {contacts.map((contact) => (
        <ContactCard
          key={contact.id}
          contact={contact}
          kinInfo={kinInfo}
          onEdit={() => openEdit(contact)}
          onDelete={() => setDeletingContact(contact)}
          onRefresh={fetchContacts}
        />
      ))}

      <Button variant="outline" onClick={openAdd} className="w-full">
        <Plus className="size-4" />
        {t('settings.contacts.add')}
      </Button>

      <ContactFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={handleSaved}
        contact={editingContact}
      />

      <AlertDialog open={!!deletingContact} onOpenChange={(v) => { if (!v) setDeletingContact(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.contacts.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.contacts.deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteContact}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
