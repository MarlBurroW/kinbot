import { z } from 'zod'
import { tool } from 'ai'
import { createLogger } from '@/server/logger'
import {
  createFileFromContent,
  createFileFromWorkspace,
  createFileFromUrl,
  getFileById,
  getFileByName,
  listFiles,
  searchFiles,
  updateFile,
  deleteFile,
} from '@/server/services/file-storage'
import type { ToolRegistration } from '@/server/tools/types'

const log = createLogger('tools:file-storage')

// ─── store_file ─────────────────────────────────────────────────────────────

export const storeFileTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Store a file and get a shareable URL. Source can be inline content, workspace file, or external URL.',
      inputSchema: z.object({
        name: z.string(),
        source: z.enum(['content', 'workspace', 'url']).describe(
          '"content" for inline text/base64, "workspace" for workspace file, "url" to download',
        ),
        content: z.string().optional().describe('Required when source is "content"'),
        isBase64: z.boolean().optional().describe('True if content is base64-encoded. Default: false'),
        filePath: z.string().optional().describe('Required when source is "workspace"'),
        url: z.string().optional().describe('Required when source is "url"'),
        mimeType: z.string().optional().describe('Auto-detected if omitted'),
        description: z.string().optional(),
        isPublic: z.boolean().optional().describe('Default: true'),
        password: z.string().optional(),
        expiresIn: z.number().optional().describe('Auto-delete after N minutes'),
        readAndBurn: z.boolean().optional().describe('Delete after first download. Default: false'),
      }),
      execute: async (args) => {
        log.debug({ kinId: ctx.kinId, name: args.name, source: args.source }, 'store_file invoked')

        try {
          const options = {
            description: args.description,
            isPublic: args.isPublic,
            password: args.password,
            expiresIn: args.expiresIn,
            readAndBurn: args.readAndBurn,
            createdByKinId: ctx.kinId,
          }

          let result
          switch (args.source) {
            case 'content': {
              if (!args.content) return { error: 'content is required when source is "content"' }
              result = await createFileFromContent(
                ctx.kinId,
                args.name,
                args.content,
                args.mimeType || 'text/plain',
                { ...options, isBase64: args.isBase64 },
              )
              break
            }
            case 'workspace': {
              if (!args.filePath) return { error: 'filePath is required when source is "workspace"' }
              result = await createFileFromWorkspace(
                ctx.kinId,
                args.filePath,
                args.name,
                options,
              )
              break
            }
            case 'url': {
              if (!args.url) return { error: 'url is required when source is "url"' }
              result = await createFileFromUrl(
                ctx.kinId,
                args.url,
                args.name,
                options,
              )
              break
            }
          }

          return result
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to store file'
          log.error({ error: err, kinId: ctx.kinId }, 'store_file failed')
          return { error: message }
        }
      },
    }),
}

// ─── get_stored_file ────────────────────────────────────────────────────────

export const getStoredFileTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Get metadata and share URL for a stored file by ID or name.',
      inputSchema: z.object({
        id: z.string().optional().describe('Provide either id or name'),
        name: z.string().optional().describe('Provide either id or name'),
      }),
      execute: async ({ id, name }) => {
        log.debug({ kinId: ctx.kinId, id, name }, 'get_stored_file invoked')

        if (!id && !name) return { error: 'Provide either id or name' }

        if (id) {
          const file = await getFileById(id)
          return file ?? { error: 'File not found' }
        }

        const file = await getFileByName(ctx.kinId, name!)
        return file ?? { error: 'File not found' }
      },
    }),
}

// ─── list_stored_files ──────────────────────────────────────────────────────

export const listStoredFilesTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'List all files in your file storage.',
      inputSchema: z.object({
        limit: z.number().optional().describe('Default: 50'),
        offset: z.number().optional().describe('Default: 0'),
      }),
      execute: async ({ limit = 50, offset = 0 }) => {
        log.debug({ kinId: ctx.kinId }, 'list_stored_files invoked')
        const allFiles = await listFiles(ctx.kinId)
        const paginated = allFiles.slice(offset, offset + limit)
        return { files: paginated, total: allFiles.length }
      },
    }),
}

// ─── search_stored_files ────────────────────────────────────────────────────

export const searchStoredFilesTool: ToolRegistration = {
  availability: ['main'],
  readOnly: true,
  create: (ctx) =>
    tool({
      description: 'Search stored files by name or description.',
      inputSchema: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        log.debug({ kinId: ctx.kinId, query }, 'search_stored_files invoked')
        const results = await searchFiles(query, ctx.kinId)
        return { files: results, total: results.length }
      },
    }),
}

// ─── update_stored_file ─────────────────────────────────────────────────────

export const updateStoredFileTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Update metadata of a stored file (name, description, access settings, expiration).',
      inputSchema: z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional().describe('Null to remove'),
        isPublic: z.boolean().optional(),
        password: z.string().nullable().optional().describe('Null to remove'),
        expiresIn: z.number().nullable().optional().describe('Minutes from now. Null to remove.'),
        readAndBurn: z.boolean().optional(),
      }),
      execute: async (args) => {
        log.debug({ kinId: ctx.kinId, fileId: args.id }, 'update_stored_file invoked')

        const updated = await updateFile(args.id, {
          name: args.name,
          description: args.description,
          isPublic: args.isPublic,
          password: args.password,
          expiresIn: args.expiresIn,
          readAndBurn: args.readAndBurn,
        })

        return updated ?? { error: 'File not found' }
      },
    }),
}

// ─── delete_stored_file ─────────────────────────────────────────────────────

export const deleteStoredFileTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description: 'Permanently delete a stored file and invalidate its share URL.',
      inputSchema: z.object({
        id: z.string(),
      }),
      execute: async ({ id }) => {
        log.debug({ kinId: ctx.kinId, fileId: id }, 'delete_stored_file invoked')
        const deleted = await deleteFile(id)
        return deleted ? { success: true } : { error: 'File not found' }
      },
    }),
}
