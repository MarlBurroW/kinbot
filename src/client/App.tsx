import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/client/hooks/useAuth'
import { LoginPage } from '@/client/pages/login/LoginPage'
import { OnboardingPage } from '@/client/pages/onboarding/OnboardingPage'
import { ChatPage } from '@/client/pages/chat/ChatPage'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DesignSystemPage } from '@/client/pages/design-system/DesignSystemPage'
import { InvitePage } from '@/client/pages/invite/InvitePage'
import { api } from '@/client/lib/api'

const isDev = import.meta.env.DEV

interface OnboardingStatus {
  completed: boolean
  hasAdmin: boolean
  hasLlm: boolean
  hasEmbedding: boolean
}

function AppRoot() {
  const { t } = useTranslation()
  const { isLoading: authLoading, isAuthenticated, login, refetch } = useAuth()
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true)
  const [backendError, setBackendError] = useState(false)

  const checkOnboarding = useCallback(async () => {
    try {
      const status = await api.get<OnboardingStatus>('/onboarding/status')
      setOnboardingStatus(status)
      setBackendError(false)
    } catch {
      setBackendError(true)
    } finally {
      setIsCheckingOnboarding(false)
    }
  }, [])

  useEffect(() => {
    checkOnboarding()
  }, [checkOnboarding])

  // Loading state
  if (authLoading || isCheckingOnboarding) {
    return (
      <div className="surface-base flex min-h-screen items-center justify-center">
        <div className="text-center animate-fade-in">
          <h1 className="gradient-primary-text text-4xl font-bold tracking-tight">KinBot</h1>
          <p className="mt-3 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // Backend unreachable — show error with retry
  if (backendError) {
    return (
      <div className="surface-base flex min-h-screen items-center justify-center">
        <div className="text-center animate-fade-in max-w-md space-y-4">
          <h1 className="gradient-primary-text text-4xl font-bold tracking-tight">KinBot</h1>
          <p className="text-muted-foreground">{t('errors.backendUnavailable')}</p>
          <button
            onClick={() => {
              setIsCheckingOnboarding(true)
              setBackendError(false)
              checkOnboarding()
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('errors.retry')}
          </button>
        </div>
      </div>
    )
  }

  // Fresh install — no admin exists, start onboarding from step 1
  if (onboardingStatus && !onboardingStatus.hasAdmin) {
    return (
      <OnboardingPage
        onComplete={async () => {
          await refetch()
          await checkOnboarding()
        }}
      />
    )
  }

  // Admin exists but onboarding incomplete (providers missing)
  // If authenticated, resume onboarding at step 3 (providers)
  if (onboardingStatus && !onboardingStatus.completed && isAuthenticated) {
    return (
      <OnboardingPage
        initialStep={3}
        onComplete={async () => {
          await refetch()
          await checkOnboarding()
        }}
      />
    )
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />
  }

  // Authenticated — main app
  return <ChatPage />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {isDev && <Route path="/design-system" element={<DesignSystemPage />} />}
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="*" element={<AppRoot />} />
      </Routes>
    </BrowserRouter>
  )
}
