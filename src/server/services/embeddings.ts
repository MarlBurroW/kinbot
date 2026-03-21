import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { providers } from '@/server/db/schema'
import { config } from '@/server/config'
import { getEmbeddingModel } from '@/server/services/app-settings'
import { decrypt } from '@/server/services/encryption'

const log = createLogger('embeddings')

/**
 * Generate embeddings for a text string using the configured embedding provider.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = await findEmbeddingProvider()
  if (!provider) {
    log.warn('No embedding provider configured')
    throw new Error('No embedding provider configured')
  }

  const providerConfig = JSON.parse(await decrypt(provider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  const embeddingModelId = (await getEmbeddingModel()) ?? config.memory.embeddingModel

  let model
  if (provider.type === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = google.embedding(embeddingModelId)
  } else {
    // Assume other configured embedding providers are OpenAI-compatible
    let baseUrl = providerConfig.baseUrl

    if (!baseUrl) {
      if (provider.type === 'openai') baseUrl = 'https://api.openai.com/v1'
      else if (provider.type === 'voyage') baseUrl = 'https://api.voyageai.com/v1'
      else if (provider.type === 'mistral') baseUrl = 'https://api.mistral.ai/v1'
      else if (provider.type === 'deepseek') baseUrl = 'https://api.deepseek.com/v1'
      else if (provider.type === 'xai') baseUrl = 'https://api.x.ai/v1'
      else if (provider.type === 'jina') baseUrl = 'https://api.jina.ai/v1'
      else if (provider.type === 'nomic') baseUrl = 'https://api-atlas.nomic.ai/v1'
      else if (provider.type === 'together') baseUrl = 'https://api.together.xyz/v1'
      else if (provider.type === 'fireworks') baseUrl = 'https://api.fireworks.ai/inference/v1'
      else if (provider.type === 'ollama') baseUrl = 'http://localhost:11434/v1'
    }

    const openai = createOpenAI({
      apiKey: providerConfig.apiKey || 'not-needed',
      baseURL: baseUrl,
    })
    model = openai.embedding(embeddingModelId)
  }

  const result = await embed({ model, value: text })
  return result.embedding
}

async function findEmbeddingProvider() {
  const allProviders = await db.select().from(providers).all()

  for (const p of allProviders) {
    try {
      const capabilities = JSON.parse(p.capabilities) as string[]
      if (capabilities.includes('embedding') && p.isValid) {
        return p
      }
    } catch {
      // Skip
    }
  }

  return null
}
