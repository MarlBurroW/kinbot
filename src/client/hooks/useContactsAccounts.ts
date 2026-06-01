import { useCallback, useEffect, useState } from 'react'
import type { ConfigField } from '@kinbot-developer/sdk'
import { api } from '@/client/lib/api'
import { registerProviderReactIcon } from '@/client/components/common/ProviderIcon'

export interface ContactsAccount {
  id: string
  slug: string
  name: string
  type: string
  accountLabel: string
  allowedKinIds: string[] | null
  isValid: boolean
  lastError: string | null
}

export interface ContactsProviderInfo {
  type: string
  displayName: string
  usesOAuth: boolean
  reactIcon: string | null
  brandColor: string | null
  consoleUrl: string | null
  /** For non-OAuth providers (CardDAV): the fields to render in the Add dialog. */
  configSchema: ConfigField[]
}

export function useContactsAccounts() {
  const [accounts, setAccounts] = useState<ContactsAccount[]>([])
  const [providers, setProviders] = useState<ContactsProviderInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([
        api.get<{ accounts: ContactsAccount[] }>('/contacts-accounts'),
        api.get<{ providers: ContactsProviderInfo[] }>('/contacts-accounts/providers'),
      ])
      for (const prov of p.providers) {
        if (prov.reactIcon) registerProviderReactIcon(prov.type, prov.reactIcon, prov.brandColor ?? undefined)
      }
      setAccounts(a.accounts)
      setProviders(p.providers)
    } catch {
      // Surfaced by callers via individual actions; list just stays empty.
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { accounts, providers, isLoading, refetch }
}
