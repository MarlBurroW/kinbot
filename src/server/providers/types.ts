import type { ProviderCapability } from '@/shared/types'

export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
}

export interface ProviderDefinition {
  type: string
  capabilities: ProviderCapability[]
  testConnection: (config: ProviderConfig) => Promise<{ valid: boolean; error?: string }>
  listModels: (config: ProviderConfig) => Promise<ProviderModel[]>
}

export interface ProviderModel {
  id: string
  name: string
  capability: 'llm' | 'embedding' | 'image'
}
