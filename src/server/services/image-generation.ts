import { generateImage, generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { providers } from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'

const log = createLogger('image-gen')

interface GenerateImageResult {
  base64: string
  mediaType: string
}

/**
 * Generate an image using a specific or the first available image provider.
 * Returns base64-encoded image data.
 */
export async function generateAvatarImage(
  prompt: string,
  options?: { providerId?: string; modelId?: string },
): Promise<GenerateImageResult> {
  let provider
  if (options?.providerId) {
    const p = await db.select().from(providers).where(eq(providers.id, options.providerId)).get()
    if (!p || !p.isValid) {
      throw new ImageGenerationError('PROVIDER_NOT_FOUND', 'Specified image provider not found or invalid')
    }
    provider = p
  } else {
    provider = await findImageProvider()
  }

  if (!provider) {
    log.warn('No image provider configured')
    throw new ImageGenerationError('NO_IMAGE_PROVIDER', 'No image provider configured')
  }

  const providerConfig = JSON.parse(await decrypt(provider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  if (provider.type === 'openai') {
    return generateWithOpenAI(providerConfig, prompt, options?.modelId)
  } else if (provider.type === 'gemini') {
    return generateWithGoogle(providerConfig, prompt, options?.modelId)
  }

  throw new ImageGenerationError(
    'UNSUPPORTED_PROVIDER',
    `Provider type ${provider.type} does not support image generation`,
  )
}

async function generateWithOpenAI(
  config: { apiKey: string; baseUrl?: string },
  prompt: string,
  modelId?: string,
): Promise<GenerateImageResult> {
  const openai = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
  const { image } = await generateImage({
    model: openai.image(modelId ?? 'dall-e-3'),
    prompt,
    size: '1024x1024' as `${number}x${number}`,
  })
  return {
    base64: image.base64,
    mediaType: image.mediaType ?? 'image/png',
  }
}

async function generateWithGoogle(
  config: { apiKey: string; baseUrl?: string },
  prompt: string,
  modelId?: string,
): Promise<GenerateImageResult> {
  const google = createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
  const { image } = await generateImage({
    model: google.image(modelId ?? 'imagen-3.0-generate-002'),
    prompt,
    aspectRatio: '1:1' as `${number}:${number}`,
  })
  return {
    base64: image.base64,
    mediaType: image.mediaType ?? 'image/png',
  }
}

async function findImageProvider() {
  const allProviders = await db.select().from(providers).all()

  for (const p of allProviders) {
    try {
      const capabilities = JSON.parse(p.capabilities) as string[]
      if (capabilities.includes('image') && p.isValid) {
        return p
      }
    } catch {
      // Skip
    }
  }

  return null
}

async function findLLMProvider() {
  const allProviders = await db.select().from(providers).all()

  for (const p of allProviders) {
    try {
      const capabilities = JSON.parse(p.capabilities) as string[]
      if (capabilities.includes('llm') && p.isValid) {
        return p
      }
    } catch {
      // Skip
    }
  }

  return null
}

/**
 * Check if avatar generation is possible (needs both image + LLM providers).
 */
export async function hasImageCapability(): Promise<boolean> {
  const [imageProvider, llmProvider] = await Promise.all([findImageProvider(), findLLMProvider()])
  return imageProvider !== null && llmProvider !== null
}

const AVATAR_STYLE_SYSTEM = `You are an image prompt writer. The user will give you the identity of a character (name, role, personality, expertise). You must write a short image generation prompt (2-3 sentences max) describing a portrait of this character.

Style guidelines:
- Cinematic CGI portrait, hyperrealistic 3D render, shallow depth of field, dramatic neon/ambient lighting
- Like a high-end video game cinematic cutscene or a sci-fi/fantasy movie character
- Face and upper body only, looking at the viewer
- The character's appearance (hair, eyes, clothing, accessories, setting) should reflect their role and personality
- Invent specific visual details: hair style and color, eye color, clothing, accessories, background elements

Example output for a tech-savvy assistant:
"A charming, tech-savvy girl with short silver pixie-cut hair and vibrant blue eyes, wearing a casual yet futuristic outfit. She's focused on a holographic interface while working in a sleek, high-tech workshop. No text, no letters, no words, no UI elements."

Rules:
- Output ONLY the image prompt, nothing else
- Never include the character's name in the prompt
- Never ask for text, labels, frames, borders, or UI elements in the image
- End the prompt with: "No text, no letters, no words, no UI elements."`

/**
 * Use an LLM to generate an image prompt from Kin metadata,
 * then use it to generate the avatar image.
 */
export async function buildAvatarPrompt(kin: {
  name: string
  role: string
  character: string
  expertise: string
}): Promise<string> {
  const llmProvider = await findLLMProvider()
  if (!llmProvider) {
    // Fallback: simple prompt without LLM
    return `Digital fantasy portrait of a character who is a ${kin.role}. Painterly style, dramatic lighting, face and upper body. No text, no letters, no words, no UI elements.`
  }

  const providerConfig = JSON.parse(await decrypt(llmProvider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  let model
  if (llmProvider.type === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = anthropic('claude-haiku-4-5-20251001')
  } else if (llmProvider.type === 'openai') {
    const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = openai('gpt-4o-mini')
  } else if (llmProvider.type === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = google('gemini-2.0-flash')
  } else {
    return `Digital fantasy portrait of a character who is a ${kin.role}. Painterly style, dramatic lighting, face and upper body. No text, no letters, no words, no UI elements.`
  }

  const charSnippet = kin.character.slice(0, 300)
  const expertSnippet = kin.expertise.slice(0, 300)

  const { text } = await generateText({
    model,
    system: AVATAR_STYLE_SYSTEM,
    prompt: `Name: ${kin.name}\nRole: ${kin.role}\nPersonality: ${charSnippet}\nExpertise: ${expertSnippet}`,
    maxTokens: 200,
  })

  return text.trim()
}

/**
 * Custom error class for image generation failures.
 */
export class ImageGenerationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
