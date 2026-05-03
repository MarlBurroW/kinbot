export interface ProviderConfig {
  apiKey: string
  baseUrl?: string
}

export interface ProviderDefinition {
  type: string
  testConnection: (config: ProviderConfig) => Promise<{ valid: boolean; error?: string }>
  listModels: (config: ProviderConfig) => Promise<ProviderModel[]>
}

export interface ProviderModel {
  id: string
  name: string
  capability: 'llm' | 'embedding' | 'image' | 'rerank'
  /** True if the image model accepts images as input (editing/inpainting) */
  supportsImageInput?: boolean
  /** Maximum input/context tokens. Populated when the provider's API exposes it. */
  contextWindow?: number
  /** Maximum output tokens. Populated when the provider's API exposes it. */
  maxOutput?: number
}
