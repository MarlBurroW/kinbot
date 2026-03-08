import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
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
import { Plus, Users, Trash2, Settings2, Network, Crown } from 'lucide-react'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { toastError } from '@/client/lib/api'
import { useTeams, type Team } from '@/client/hooks/useTeams'
import { useKinList } from '@/client/hooks/useKinList'
import { TeamFormDialog } from '@/client/components/team/TeamFormDialog'
import type { KinOption } from '@/client/components/common/KinSelectItem'

export function TeamsSettings() {
  const { t } = useTranslation()
  const { teams, isLoading, createTeam, updateTeam, deleteTeam, addMember, removeMember } = useTeams()
  const { kins: kinList } = useKinList()
  const kins: KinOption[] = kinList.map((k) => ({ id: k.id, name: k.name, role: k.role ?? '', avatarUrl: k.avatarUrl }))

  const [formOpen, setFormOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null)

  const handleCreate = useCallback(() => {
    setEditingTeam(null)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((team: Team) => {
    setEditingTeam(team)
    setFormOpen(true)
  }, [])

  const handleSave = useCallback(async (data: {
    name: string
    description?: string
    icon?: string
    color?: string
    hubKinId: string
    memberKinIds: string[]
  }) => {
    try {
      if (editingTeam) {
        // Update team
        await updateTeam(editingTeam.id, {
          name: data.name,
          description: data.description || null,
          icon: data.icon || null,
          color: data.color || null,
          hubKinId: data.hubKinId,
        })

        // Sync members: add new, remove old
        const currentMemberIds = new Set(editingTeam.members.map((m) => m.kinId))
        const newMemberIds = new Set([data.hubKinId, ...data.memberKinIds])

        for (const kinId of newMemberIds) {
          if (!currentMemberIds.has(kinId)) {
            await addMember(editingTeam.id, kinId)
          }
        }
        for (const kinId of currentMemberIds) {
          if (!newMemberIds.has(kinId) && kinId !== data.hubKinId) {
            try {
              await removeMember(editingTeam.id, kinId)
            } catch { /* hub removal is expected to fail */ }
          }
        }

        toast.success(t('teams.updated'))
      } else {
        await createTeam({
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
          hubKinId: data.hubKinId,
          memberKinIds: data.memberKinIds,
        })
        toast.success(t('teams.created'))
      }
      setFormOpen(false)
      setEditingTeam(null)
    } catch (err) {
      toastError(err)
    }
  }, [editingTeam, updateTeam, createTeam, addMember, removeMember, t])

  const handleDelete = useCallback(async () => {
    if (!deletingTeam) return
    try {
      await deleteTeam(deletingTeam.id)
      toast.success(t('teams.deleted'))
    } catch (err) {
      toastError(err)
    } finally {
      setDeletingTeam(null)
    }
  }, [deletingTeam, deleteTeam, t])

  if (isLoading) return <SettingsListSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('teams.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('teams.settingsDescription', 'Group your Kins into teams with a Hub coordinator.')}</p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="size-4 mr-1" />
          {t('teams.createTeam')}
        </Button>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('teams.noTeams')}
          description={t('teams.emptyDescription', 'Create a team to group Kins together with a Hub coordinator.')}
          actionLabel={t('teams.createTeam')}
          onAction={handleCreate}
        />
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border p-4 space-y-3 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: team.color ? `${team.color}20` : undefined }}
                  >
                    {team.icon || '👥'}
                  </div>
                  <div>
                    <h4 className="font-medium">{team.name}</h4>
                    {team.description && (
                      <p className="text-xs text-muted-foreground">{team.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(team)}>
                    <Settings2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingTeam(team)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {team.members.map((member) => (
                  <Badge
                    key={member.kinId}
                    variant={member.teamRole === 'hub' ? 'default' : 'secondary'}
                    className="gap-1.5 py-1 px-2"
                  >
                    {member.kinAvatarPath ? (
                      <img src={member.kinAvatarPath} alt="" className="size-4 rounded-full" />
                    ) : member.teamRole === 'hub' ? (
                      <Network className="size-3" />
                    ) : null}
                    {member.kinName}
                    {member.teamRole === 'hub' && (
                      <Crown className="size-3 ml-0.5" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <TeamFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingTeam(null) }}
        team={editingTeam}
        kins={kins}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => { if (!open) setDeletingTeam(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('teams.deleteTeam')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('teams.confirmDelete')}
              <br />
              <span className="text-xs">{t('teams.deleteWarning')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('teams.deleteTeam')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
