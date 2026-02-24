import { tool } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { db } from '@/server/db/index'
import { files, providers } from '@/server/db/schema'
import { generateImage, hasImageCapability } from '@/server/services/image-generation'
import { listModelsForProvider } from '@/server/providers/index'
import { decrypt } from '@/server/services/encryption'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:image')

/**
 * list_image_models — list available image generation models.
 * Available to main agents and sub-kins.
 */
export const listImageModelsTool: ToolRegistration = {
  availability: ['main', 'sub-kin'],
  create: (_ctx) =>
    tool({
      description:
        'List all available image generation models across configured providers. ' +
        'Returns model IDs, provider info, and whether each model supports image input (editing/inpainting). ' +
        'Use this to discover which models you can pass to generate_image.',
      inputSchema: z.object({}),
      execute: async () => {
        const allProviders = await db.select().from(providers).all()
        const models: Array<{
          id: string
          name: string
          providerId: string
          providerName: string
          providerType: string
          supportsImageInput: boolean
        }> = []

        for (const p of allProviders) {
          if (!p.isValid) continue
          try {
            const capabilities = JSON.parse(p.capabilities) as string[]
            if (!capabilities.includes('image')) continue

            const providerConfig = JSON.parse(await decrypt(p.configEncrypted))
            const providerModels = await listModelsForProvider(p.type, providerConfig)

            for (const model of providerModels) {
              if (model.capability !== 'image') continue
              models.push({
                id: model.id,
                name: model.name,
                providerId: p.id,
                providerName: p.name,
                providerType: p.type,
                supportsImageInput: model.supportsImageInput ?? false,
              })
            }
          } catch (err) {
            log.error({ providerId: p.id, err }, 'Failed to list image models for provider')
          }
        }

        if (models.length === 0) {
          return { models: [], note: 'No image models available. Ask the user to configure a provider with image capability (OpenAI or Google).' }
        }

        return { models }
      },
    }),
}

/**
 * generate_image — generate an image from a text prompt, optionally with a source image for editing.
 * Saves the result to disk and returns a URL.
 * Available to main agents only.
 *
 * Note: The tool always registers, but returns an error at runtime
 * if no image provider is configured. This keeps the tool visible
 * in the system prompt so the Kin knows the capability exists.
 */
export const generateImageTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Generate an image from a text prompt, or edit an existing image using a prompt. ' +
        'Returns the URL of the generated image. ' +
        'Use list_image_models() first to see available models and their capabilities. ' +
        'If imageUrl is provided, the model must support image input (supportsImageInput=true). ' +
        'imageUrl can be an internal file URL (e.g. /api/uploads/..., /api/file-storage/...) or an external URL (https://...).',
      inputSchema: z.object({
        prompt: z
          .string()
          .describe('Detailed text description of the image to generate, or editing instructions if imageUrl is provided'),
        modelId: z
          .string()
          .optional()
          .describe('Image model ID to use (e.g. "dall-e-3", "gpt-image-1", "imagen-3.0-generate-002"). Use list_image_models() to see available options. If omitted, uses the default model for the provider.'),
        providerId: z
          .string()
          .optional()
          .describe('Provider ID to use if you have multiple image providers. If omitted, auto-selects the first available image provider.'),
        imageUrl: z
          .string()
          .optional()
          .describe('URL of a source image for editing/inpainting. Can be an internal URL (/api/uploads/..., /api/file-storage/...) or an external URL (https://...). Only works with models that support image input.'),
        filename: z
          .string()
          .optional()
          .describe('Optional filename for the generated image (default: generated-{id}.png)'),
      }),
      execute: async ({ prompt, modelId, providerId, imageUrl, filename }) => {
        log.debug({ kinId: ctx.kinId, modelId, providerId, hasImageUrl: !!imageUrl }, 'Image generation requested')

        // Check if image generation is available
        const available = await hasImageCapability()
        if (!available) {
          return {
            error: 'No image provider configured. Ask the user to configure an OpenAI or Google provider with image capability.',
          }
        }

        try {
          const result = await generateImage(prompt, { providerId, modelId, imageUrl })

          // Determine file extension from media type
          const ext = result.mediaType === 'image/jpeg' ? 'jpg'
            : result.mediaType === 'image/webp' ? 'webp'
            : 'png'

          const fileId = uuid()
          const storedName = filename
            ? `${fileId}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`
            : `${fileId}-generated.${ext}`
          const dir = join(config.upload.dir, 'messages', ctx.kinId)
          const storedPath = join(dir, storedName)

          // Ensure directory exists
          await mkdir(dir, { recursive: true })

          // Write base64 to disk
          const buffer = Buffer.from(result.base64, 'base64')
          await Bun.write(storedPath, buffer)

          // Save to files table
          await db.insert(files).values({
            id: fileId,
            kinId: ctx.kinId,
            originalName: filename ?? `generated.${ext}`,
            storedPath,
            mimeType: result.mediaType,
            size: buffer.length,
            createdAt: new Date(),
          })

          const url = `/api/uploads/messages/${ctx.kinId}/${storedName}`

          return {
            success: true,
            fileId,
            url,
            mimeType: result.mediaType,
            size: buffer.length,
          }
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Image generation failed',
          }
        }
      },
    }),
}
