import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'
import { Checkbox } from '@/client/components/ui/checkbox'
import { KinSelector } from '@/client/components/common/KinSelector'
import { Loader2, Network } from 'lucide-react'
import type { Team } from '@/client/hooks/useTeams'
import type { KinOption } from '@/client/components/common/KinSelectItem'

interface TeamFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: Team | null
  kins: KinOption[]
  onSave: (data: {
    name: string
    description?: string
    icon?: string
    color?: string
    hubKinId: string
    memberKinIds: string[]
  }) => Promise<void>
}

const TEAM_ICONS = ['👥', '🚀', '💡', '🔧', '🎯', '🏠', '📊', '🎨', '🔬', '⚡', '🌐', '🛡️']

export function TeamFormDialog({ open, onOpenChange, team, kins, onSave }: TeamFormDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('👥')
  const [color, setColor] = useState('#6366f1')
  const [hubKinId, setHubKinId] = useState('')
  const [memberKinIds, setMemberKinIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Reset form when opening/changing team
  useEffect(() => {
    if (open) {
      if (team) {
        setName(team.name)
        setDescription(team.description || '')
        setIcon(team.icon || '👥')
        setColor(team.color || '#6366f1')
        setHubKinId(team.hubKinId)
        setMemberKinIds(new Set(team.members.filter((m) => m.teamRole !== 'hub').map((m) => m.kinId)))
      } else {
        setName('')
        setDescription('')
        setIcon('👥')
        setColor('#6366f1')
        setHubKinId('')
        setMemberKinIds(new Set())
      }
    }
  }, [open, team])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !hubKinId) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        hubKinId,
        memberKinIds: Array.from(memberKinIds),
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleMember = (kinId: string) => {
    setMemberKinIds((prev) => {
      const next = new Set(prev)
      if (next.has(kinId)) next.delete(kinId)
      else next.add(kinId)
      return next
    })
  }

  // Available kins for member selection (exclude the hub)
  const availableForMembers = kins.filter((k) => k.id !== hubKinId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {team ? t('teams.editTeam') : t('teams.createTeam')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {team ? t('teams.editTeam') : t('teams.createTeam')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="team-name">{t('teams.teamName')}</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('teams.teamName')}
              maxLength={100}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="team-desc">{t('teams.teamDescription')}</Label>
            <Textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('teams.teamDescription')}
              rows={2}
            />
          </div>

          {/* Icon + Color */}
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <Label>{t('teams.teamIcon')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {TEAM_ICONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`size-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
                      icon === emoji
                        ? 'bg-primary/20 ring-2 ring-primary'
                        : 'bg-secondary hover:bg-accent'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-color">{t('teams.teamColor')}</Label>
              <Input
                id="team-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-16 cursor-pointer p-0.5"
              />
            </div>
          </div>

          {/* Hub Kin */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Network className="size-3.5" />
              {t('teams.hubKin')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('teams.selectHubKin')}</p>
            <KinSelector
              value={hubKinId}
              onValueChange={(v) => {
                setHubKinId(v)
                // Remove hub from members if selected
                setMemberKinIds((prev) => {
                  const next = new Set(prev)
                  next.delete(v)
                  return next
                })
              }}
              kins={kins}
              placeholder={t('teams.selectHubKin')}
              required
            />
          </div>

          {/* Members */}
          <div className="space-y-1.5">
            <Label>{t('teams.members')}</Label>
            <p className="text-xs text-muted-foreground">{t('teams.selectMembers')}</p>
            {hubKinId ? (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2">
                {availableForMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">
                    {t('teams.noOtherKins', 'No other Kins available')}
                  </p>
                ) : (
                  availableForMembers.map((kin) => (
                    <label
                      key={kin.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={memberKinIds.has(kin.id)}
                        onCheckedChange={() => toggleMember(kin.id)}
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        {kin.avatarUrl ? (
                          <img src={kin.avatarUrl} alt="" className="size-6 rounded-lg" />
                        ) : (
                          <div className="size-6 rounded-lg bg-secondary flex items-center justify-center">
                            <span className="text-[10px]">🤖</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="text-sm font-medium truncate block">{kin.name}</span>
                          {kin.role && <span className="text-[10px] text-muted-foreground truncate block">{kin.role}</span>}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                {t('teams.selectHubFirst', 'Select a Hub Kin first')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !hubKinId}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
              {team ? t('common.save') : t('teams.createTeam')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
