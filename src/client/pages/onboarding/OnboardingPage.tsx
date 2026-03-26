import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/client/components/ui/progress'
import { StepIdentity } from '@/client/pages/onboarding/StepIdentity'
import { StepPreferences } from '@/client/pages/onboarding/StepPreferences'
import { StepProviders } from '@/client/pages/onboarding/StepProviders'
import { StepDefaultModels } from '@/client/pages/onboarding/StepDefaultModels'

const TOTAL_STEPS = 4

interface OnboardingPageProps {
  onComplete: () => void
  initialStep?: number
}

export function OnboardingPage({ onComplete, initialStep = 1 }: OnboardingPageProps) {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(initialStep)

  const progressValue = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="surface-base flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Decorative orbs */}
      <div className="theme-orb theme-orb-1 fixed left-1/4 top-1/4 h-64 w-64 aurora-drift" />
      <div className="theme-orb theme-orb-2 fixed right-1/4 bottom-1/4 h-48 w-48 aurora-drift delay-3" />
      <div className="theme-orb theme-orb-3 fixed left-1/2 top-2/3 h-56 w-56 aurora-drift delay-5" />

      <div className="relative z-10 w-full max-w-lg animate-fade-in-up">
        {/* Header */}
        <div className="mb-8 text-center">
          <img src="/kinbot.svg" alt="KinBot" width={64} height={64} className="mx-auto mb-3 rounded-2xl drop-shadow-lg" />
          <h1 className="gradient-primary-text text-3xl font-bold tracking-tight">
            KinBot
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('onboarding.subtitle')}
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('onboarding.step', { current: currentStep, total: TOTAL_STEPS })}</span>
          </div>
          <Progress value={progressValue} variant="gradient" active />
        </div>

        {/* Step card */}
        <div className="glass-strong rounded-2xl p-8 shadow-lg">
          {currentStep === 1 && (
            <StepIdentity onComplete={() => setCurrentStep(2)} />
          )}
          {currentStep === 2 && (
            <StepPreferences onComplete={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />
          )}
          {currentStep === 3 && (
            <StepProviders
              onComplete={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
              onQuickFinish={onComplete}
            />
          )}
          {currentStep === 4 && (
            <StepDefaultModels onComplete={onComplete} onBack={() => setCurrentStep(3)} />
          )}
        </div>
      </div>
    </div>
  )
}
