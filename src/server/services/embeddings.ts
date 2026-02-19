import { embed } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'
import { config } from '@/server/config'
import { decrypt } from '@/server/services/encryption'

/**
 * Generate embeddings for a text string using the configured embedding provider.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = await findEmbeddingProvider()
  if (!provider) {
    throw new Error('No embedding provider configured')
  }

  const providerConfig = JSON.parse(await decrypt(provider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  let model
  if (provider.type === 'openai') {
    const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = openai.embedding(config.memory.embeddingModel)
  } else if (provider.type === 'voyage') {
    const voyage = createOpenAI({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.baseUrl ?? 'https://api.voyageai.com/v1',
    })
    model = voyage.embedding(config.memory.embeddingModel)
  } else {
    throw new Error(`Provider type ${provider.type} does not support embeddings`)
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
