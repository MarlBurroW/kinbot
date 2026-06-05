import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ExternalLink, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/client/components/ui/dialog'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { useSecretPrompts } from '@/client/hooks/useSecretPrompts'

/**
 * Secure-input modal — appears when the configurator Kin requests a secret
 * (API key, token) via request_provider_setup / prompt_secret. The value is
 * POSTed straight to the server (→ vault); it never goes through the LLM.
 *
 * Self-contained: pass the active Kin id; it subscribes to that Kin's pending
 * secret prompts and renders one at a time.
 */
export function SecretPromptModal({ kinId }: { kinId: string | null }) {
  const { t } = useTranslation()
  const { prompts, respond, isResponding } = useSecretPrompts(kinId)
  const [values, setValues] = useState<Record<string, string>>({})
  const [dismissed, setDismissed] = useState<string | null>(null)

  const prompt = prompts.find((p) => p.promptId !== dismissed) ?? null

  // Reset the form whenever a different prompt comes to the front.
  useEffect(() => {
    setValues({})
  }, [prompt?.promptId])

  if (!prompt) return null

  const canSubmit = prompt.fields.every((f) => !f.secret || (values[f.key]?.trim().length ?? 0) > 0)

  const handleSubmit = async () => {
    try {
      await respond(prompt.promptId, values)
      setValues({})
    } catch {
      // toast handled in the hook
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) setDismissed(prompt.promptId) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            {prompt.title}
          </DialogTitle>
          {prompt.description && <DialogDescription>{prompt.description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {prompt.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`secret-${field.key}`}>{field.label}</Label>
              <Input
                id={`secret-${field.key}`}
                type={field.secret ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit() }}
                autoFocus
              />
              {field.description && (
                <p className="text-xs text-muted-foreground">{field.description}</p>
              )}
              {field.keyUrl && (
                <a
                  href={field.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {t('secretPrompt.getKey', 'Get your key here')}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          ))}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3 shrink-0" />
            {t('secretPrompt.privacyNote', 'This goes straight to your encrypted vault — the AI never sees it.')}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setDismissed(prompt.promptId)} disabled={isResponding}>
            {t('secretPrompt.later', 'Later')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isResponding}>
            {isResponding ? t('secretPrompt.saving', 'Saving…') : t('secretPrompt.submit', 'Save securely')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
