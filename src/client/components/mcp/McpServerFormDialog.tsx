import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { PasswordInput } from '@/client/components/ui/password-input'
import { Textarea } from '@/client/components/ui/textarea'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { FormErrorAlert } from '@/client/components/common/FormErrorAlert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { InfoTip } from '@/client/components/common/InfoTip'
import { api, getErrorMessage } from '@/client/lib/api'
import type { McpServerData } from '@/client/components/mcp/McpServerCard'

interface McpServerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  server?: McpServerData | null
}

interface EnvVar {
  key: string
  value: string
}

export function McpServerFormDialog({
  open,
  onOpenChange,
  onSaved,
  server,
}: McpServerFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!server

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [argsText, setArgsText] = useState('')
  const [envVars, setEnvVars] = useState<EnvVar[]>([])

  useEffect(() => {
    if (open && server) {
      setName(server.name)
      setCommand(server.command)
      setArgsText(server.args.join('\n'))
      setEnvVars(
        server.env
          ? Object.entries(server.env).map(([key, value]) => ({ key, value: '' }))
          : [],
      )
      setError('')
    } else if (open) {
      setName('')
      setCommand('')
      setArgsText('')
      setEnvVars([])
      setError('')
    }
  }, [open, server])

  const handleClose = () => {
    onOpenChange(false)
  }

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    setEnvVars((prev) =>
      prev.map((v, i) => (i === index ? { key: field === 'key' ? val : v.key, value: field === 'value' ? val : v.value } : v)),
    )
  }

  const buildEnvObject = (): Record<string, string> | undefined => {
    const filtered = envVars.filter((v) => v.key.trim() !== '')
    if (filtered.length === 0) return undefined

    if (isEditing) {
      // For editing: keep existing values for vars where user didn't enter a new value
      const result: Record<string, string> = {}
      for (const v of filtered) {
        if (v.value) {
          result[v.key.trim()] = v.value
        } else if (server?.env) {
          const existing = server.env[v.key.trim()]
          if (existing !== undefined) result[v.key.trim()] = existing
          else result[v.key.trim()] = ''
        } else {
          result[v.key.trim()] = ''
        }
      }
      return Object.keys(result).length > 0 ? result : undefined
    }

    const result: Record<string, string> = {}
    for (const v of filtered) {
      result[v.key.trim()] = v.value ?? ''
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    try {
      const args = argsText
        .split('\n')
        .map((a) => a.trim())
        .filter((a) => a !== '')
      const env = buildEnvObject()

      if (isEditing) {
        await api.patch(`/mcp-servers/${server!.id}`, { name, command, args, env })
      } else {
        await api.post('/mcp-servers', { name, command, args, env })
      }
      onSaved()
      handleClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = name.trim() !== '' && command.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('settings.mcp.edit') : t('settings.mcp.add')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('settings.mcp.editHint') : t('settings.mcp.addHint')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormErrorAlert error={error} />

          <div className="space-y-2">
            <Label htmlFor="mcp-name" className="inline-flex items-center gap-1.5">{t('settings.mcp.name')} <InfoTip content={t('settings.mcp.nameTip')} /></Label>
            <Input
              id="mcp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.mcp.namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-command" className="inline-flex items-center gap-1.5">{t('settings.mcp.command')} <InfoTip content={t('settings.mcp.commandTip')} /></Label>
            <Input
              id="mcp-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t('settings.mcp.commandPlaceholder')}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mcp-args" className="inline-flex items-center gap-1.5">
              {t('settings.mcp.args')} <InfoTip content={t('settings.mcp.argsTip')} />
              <span className="ml-1 text-xs text-muted-foreground">
                ({t('common.optional')})
              </span>
            </Label>
            <Textarea
              id="mcp-args"
              value={argsText}
              onChange={(e) => setArgsText(e.target.value)}
              placeholder={t('settings.mcp.argsPlaceholder')}
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              {t('settings.mcp.env')} <InfoTip content={t('settings.mcp.envTip')} />
              <span className="ml-1 text-xs text-muted-foreground">
                ({t('common.optional')})
              </span>
            </Label>
            {isEditing && envVars.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('settings.mcp.envPreserveHint', 'Leave values empty to keep existing secrets')}
              </p>
            )}
            <div className="space-y-2">
              {envVars.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={v.key}
                    onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                    placeholder={t('settings.mcp.envKeyPlaceholder')}
                    className="font-mono text-sm flex-[2]"
                  />
                  <PasswordInput
                    value={v.value}
                    onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                    placeholder={isEditing ? '••••••••' : t('settings.mcp.envValuePlaceholder')}
                    className="text-sm flex-[3]"
                    autoComplete="off"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeEnvVar(i)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addEnvVar} className="text-xs">
                <Plus className="size-3.5" />
                {t('settings.mcp.addEnvVar')}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !canSave}
            className="btn-shine"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEditing ? (
              t('common.save')
            ) : (
              t('settings.mcp.add')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
