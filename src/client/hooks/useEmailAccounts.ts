import { useCallback, useEffect, useState } from 'react'
import { api } from '@/client/lib/api'
import { registerProviderReactIcon } from '@/client/components/common/ProviderIcon'

export interface EmailAccount {
  id: string
  slug: string
  name: string
  type: string
  emailAddress: string
  sendMode: 'direct' | 'approval'
  allowedKinIds: string[] | null
  isValid: boolean
  lastError: string | null
}

export interface EmailProviderInfo {
  type: string
  displayName: string
  usesOAuth: boolean
  /** Whether the operator has configured this provider's OAuth app credentials. */
  oauthConfigured: boolean
  /** react-icons identifier ("si/SiGmail") + brand color for the provider logo. */
  reactIcon: string | null
  brandColor: string | null
}

export function useEmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [providers, setProviders] = useState<EmailProviderInfo[]>([])
  const [redirectUri, setRedirectUri] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([
        api.get<{ accounts: EmailAccount[] }>('/email-accounts'),
        api.get<{ providers: EmailProviderInfo[]; redirectUri: string }>('/email-accounts/providers'),
      ])
      setRedirectUri(p.redirectUri)
      // Register provider logos before rendering so <ProviderIcon> resolves
      // them (keyed by provider type, same registry as the AI providers).
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

  return { accounts, providers, redirectUri, isLoading, refetch }
}
