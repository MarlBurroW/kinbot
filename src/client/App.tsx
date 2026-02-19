import { useTranslation } from 'react-i18next'

export function App() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary">KinBot</h1>
        <p className="mt-2 text-muted-foreground">
          {t('common.loading')}
        </p>
      </div>
    </div>
  )
}
