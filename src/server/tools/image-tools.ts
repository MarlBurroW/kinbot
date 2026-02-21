import { tool } from 'ai'
import { z } from 'zod'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { db } from '@/server/db/index'
import { files } from '@/server/db/schema'
import { generateAvatarImage, hasImageCapability } from '@/server/services/image-generation'
import { config } from '@/server/config'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:image')

/**
 * generate_image — generate an image from a text prompt.
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
        'Generate an image from a text prompt using an AI image provider. ' +
        'Returns the URL of the generated image. ' +
        'Only works if an image provider (e.g. OpenAI DALL-E, Google Imagen) is configured.',
      inputSchema: z.object({
        prompt: z
          .string()
          .describe('Detailed text description of the image to generate'),
        filename: z
          .string()
          .optional()
          .describe('Optional filename for the generated image (default: generated-{id}.png)'),
      }),
      execute: async ({ prompt, filename }) => {
        log.debug({ kinId: ctx.kinId }, 'Image generation requested')
        // Check if image generation is available
        const available = await hasImageCapability()
        if (!available) {
          return {
            error: 'No image provider configured. Ask the user to configure an OpenAI or Google provider with image capability.',
          }
        }

        try {
          const result = await generateAvatarImage(prompt)

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
