import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Cpu, Bot, Network, Radio, Sparkles } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { api } from '@/client/lib/api'
import { cn } from '@/client/lib/utils'
import { AI_PROVIDER_TYPES } from '@/shared/constants'

interface StepProps {
  number: number
  title: string
  description: string
  done: boolean
  active: boolean
  icon: React.ElementType
  actionLabel?: string
  onAction?: () => void
}

function Step({ number, title, description, done, active, icon: Icon, actionLabel, onAction }: StepProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 transition-all',
        done && 'border-emerald-500/30 bg-emerald-500/5',
        active && !done && 'border-primary/40 bg-primary/5 shadow-sm',
        !active && !done && 'border-border/40 opacity-50',
      )}
    >
      {/* Step indicator */}
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
          done && 'bg-emerald-500 text-white',
          active && !done && 'bg-primary text-primary-foreground',
          !active && !done && 'bg-muted text-muted-foreground',
        )}
      >
        {done ? <Check className="size-4" /> : number}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <Icon className={cn('size-4', done ? 'text-emerald-500' : active ? 'text-primary' : 'text-muted-foreground')} />
          <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
            {title}
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
        {active && !done && actionLabel && onAction && (
          <Button
            size="sm"
            variant="default"
            className="mt-2 gap-1.5"
            onClick={onAction}
          >
            {actionLabel}
            <ChevronRight className="size-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

interface GettingStartedChecklistProps {
  /** Number of non-hub Kins */
  specialistKinCount: number
  hubKinId: string | null
  onCreateHub: () => void
  onCreateKin: () => void
  onOpenSettings: (section?: string) => void
}

export function GettingStartedChecklist({ specialistKinCount, hubKinId, onCreateHub, onCreateKin, onOpenSettings }: GettingStartedChecklistProps) {
  const { t } = useTranslation()
  const [providerCount, setProviderCount] = useState<number | null>(null)
  const [channelCount, setChannelCount] = useState<number | null>(null)

  useEffect(() => {
    api
      .get<{ providers: { type: string }[] }>('/providers')
      .then((data) => {
        const aiProviders = data.providers.filter((p) =>
          (AI_PROVIDER_TYPES as readonly string[]).includes(p.type),
        )
        setProviderCount(aiProviders.length)
      })
      .catch(() => setProviderCount(0))

    api
      .get<{ channels: unknown[] }>('/channels')
      .then((data) => setChannelCount(data.channels.length))
      .catch(() => setChannelCount(0))
  }, [])

  if (providerCount === null) return null

  const hasProviders = providerCount > 0
  const hasHub = !!hubKinId
  const hasChannels = (channelCount ?? 0) > 0
  const hasSpecialists = specialistKinCount > 0

  // Determine active step (4 steps: providers → hub → specialist → channels)
  const activeStep = !hasProviders ? 1 : !hasHub ? 2 : !hasSpecialists ? 3 : !hasChannels ? 4 : 0

  return (
    <div className="w-full max-w-md space-y-6 animate-fade-in-up">
      <div className="text-center space-y-2">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary/10">
          <Sparkles className="size-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">{t('chat.welcome.title')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('chat.welcome.checklistIntro')}
        </p>
      </div>

      <div className="space-y-2">
        <Step
          number={1}
          title={t('chat.welcome.step1Title')}
          description={t('chat.welcome.step1Desc')}
          done={hasProviders}
          active={activeStep === 1}
          icon={Cpu}
          actionLabel={t('chat.welcome.step1Action')}
          onAction={() => onOpenSettings('providers')}
        />
        <Step
          number={2}
          title={t('chat.welcome.step2Title')}
          description={t('chat.welcome.step2Desc')}
          done={hasHub}
          active={activeStep === 2}
          icon={Network}
          actionLabel={t('chat.welcome.step2Action')}
          onAction={onCreateHub}
        />
        <Step
          number={3}
          title={t('chat.welcome.step3Title')}
          description={t('chat.welcome.step3Desc')}
          done={hasSpecialists && hasHub}
          active={activeStep === 3}
          icon={Bot}
          actionLabel={t('chat.welcome.step3Action')}
          onAction={onCreateKin}
        />
        <Step
          number={4}
          title={t('chat.welcome.step4Title')}
          description={t('chat.welcome.step4Desc')}
          done={hasChannels}
          active={activeStep === 4}
          icon={Radio}
          actionLabel={t('chat.welcome.step4Action')}
          onAction={() => onOpenSettings('channels')}
        />
      </div>

      {activeStep === 0 && (
        <p className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          {t('chat.welcome.allDone')}
        </p>
      )}
    </div>
  )
}
