import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/client/components/ui/button'
import { Label } from '@/client/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/client/components/ui/select'
import { Sun, Moon, Monitor } from 'lucide-react'
import { usePalette, useTheme, PALETTES } from '@/client/components/theme-provider'

interface StepPreferencesProps {
  onComplete: () => void
  onBack: () => void
}

export function StepPreferences({ onComplete, onBack }: StepPreferencesProps) {
  const { t, i18n } = useTranslation()
  const { palette, setPalette } = usePalette()
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState(i18n.language || 'en')

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {t('onboarding.preferences.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('onboarding.preferences.subtitle')}
        </p>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <Label>{t('onboarding.preferences.language')}</Label>
        <Select value={language} onValueChange={(v) => { setLanguage(v); i18n.changeLanguage(v) }}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fr">Français</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Color theme */}
      <div className="space-y-2">
        <Label>{t('onboarding.preferences.theme')}</Label>
        <div className="grid grid-cols-4 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-all hover:border-primary ${
                palette === p.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border'
              }`}
            >
              <div className="flex gap-0.5">
                {p.colors.map((color, i) => (
                  <div
                    key={i}
                    className="size-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                {p.name}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('onboarding.preferences.themeHint')}
        </p>
      </div>

      {/* Theme mode */}
      <div className="space-y-2">
        <Label>{t('onboarding.preferences.themeMode')}</Label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'light', label: t('onboarding.preferences.themeModeLight'), icon: Sun },
            { value: 'dark', label: t('onboarding.preferences.themeModeDark'), icon: Moon },
            { value: 'system', label: t('onboarding.preferences.themeModeSystem'), icon: Monitor },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all hover:border-primary ${
                theme === value
                  ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} size="lg">
          {t('common.back')}
        </Button>
        <Button onClick={onComplete} className="btn-shine flex-1" size="lg">
          {t('common.next')}
        </Button>
      </div>
    </div>
  )
}
