import type { EmailProvider } from '@/server/email/types'

const registry = new Map<string, EmailProvider>()

export function registerEmailProvider(provider: EmailProvider): void {
  if (registry.has(provider.type)) {
    throw new Error(`Email provider already registered: ${provider.type}`)
  }
  registry.set(provider.type, provider)
}

export function unregisterEmailProvider(type: string): void {
  registry.delete(type)
}

export function getEmailProvider(type: string): EmailProvider | undefined {
  return registry.get(type)
}

export function listEmailProviders(): EmailProvider[] {
  return [...registry.values()]
}
