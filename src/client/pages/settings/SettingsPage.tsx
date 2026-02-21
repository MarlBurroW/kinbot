import { useTranslation } from 'react-i18next'
import { SidebarTrigger } from '@/client/components/ui/sidebar'
import { Separator } from '@/client/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import { ProvidersSettings } from '@/client/pages/settings/ProvidersSettings'
import { SearchProvidersSettings } from '@/client/pages/settings/SearchProvidersSettings'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <>
      {/* Header */}
      <header className="surface-header sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-5" />
        <h2 className="text-sm font-medium">{t('settings.title')}</h2>
      </header>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-2xl">
          <Tabs defaultValue="providers">
            <TabsList>
              <TabsTrigger value="providers">{t('settings.providers.title')}</TabsTrigger>
              <TabsTrigger value="search">{t('settings.searchProviders.title')}</TabsTrigger>
              <TabsTrigger value="mcp">{t('settings.mcp.title')}</TabsTrigger>
              <TabsTrigger value="vault">{t('settings.vault.title')}</TabsTrigger>
            </TabsList>

            <TabsContent value="providers" className="mt-6">
              <ProvidersSettings />
            </TabsContent>

            <TabsContent value="search" className="mt-6">
              <SearchProvidersSettings />
            </TabsContent>

            <TabsContent value="mcp" className="mt-6">
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {t('settings.mcp.description')}
              </div>
            </TabsContent>

            <TabsContent value="vault" className="mt-6">
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {t('settings.vault.description')}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}
