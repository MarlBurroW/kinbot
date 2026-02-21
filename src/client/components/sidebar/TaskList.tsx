import { useTranslation } from 'react-i18next'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@/client/components/ui/sidebar'

export function TaskList() {
  const { t } = useTranslation()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('sidebar.tasks.title')}</SidebarGroupLabel>
      <SidebarGroupContent>
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          {t('sidebar.tasks.empty')}
        </p>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
