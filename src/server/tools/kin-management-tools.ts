import { tool } from 'ai'
import { z } from 'zod'
import {
  createKin,
  updateKin,
  deleteKin,
  getKinDetails,
  generateAndSaveAvatar,
} from '@/server/services/kins'
import { resolveKinId } from '@/server/services/kin-resolver'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'
import type { KinToolConfig } from '@/shared/types'

const log = createLogger('tools:kin-management')

/**
 * create_kin — create a new permanent Kin on the platform.
 * Opt-in tool: disabled by default.
 */
export const createKinTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Create a new Kin on the platform. Immediately available after creation.',
      inputSchema: z.object({
        name: z.string(),
        role: z.string(),
        character: z.string().describe('Personality and communication style'),
        expertise: z.string(),
        model: z.string().describe('LLM model ID (e.g. "claude-sonnet-4-20250514", "gpt-4o")'),
        generate_avatar: z
          .boolean()
          .optional()
          .default(false),
      }),
      execute: async ({ name, role, character, expertise, model, generate_avatar }) => {
        log.info({ kinId: ctx.kinId, newKinName: name }, 'Kin creation requested via tool')

        try {
          const newKin = await createKin({
            name,
            role,
            character,
            expertise,
            model,
            createdBy: ctx.userId ?? null,
          })

          let avatarUrl: string | null = null
          if (generate_avatar) {
            try {
              avatarUrl = await generateAndSaveAvatar(newKin.id)
            } catch (err) {
              log.warn({ kinId: newKin.id, err }, 'Avatar generation failed during kin creation')
            }
          }

          return {
            id: newKin.id,
            slug: newKin.slug,
            name: newKin.name,
            role: newKin.role,
            model: newKin.model,
            avatarUrl,
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Failed to create Kin' }
        }
      },
    }),
}

/**
 * update_kin — update an existing Kin's properties and/or tool configuration.
 * Opt-in tool: disabled by default.
 */
export const updateKinTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        "Update a Kin's properties or tool configuration. Cannot modify yourself.",
      inputSchema: z.object({
        kin_id: z.string().describe('Slug or UUID'),
        name: z.string().optional(),
        role: z.string().optional(),
        character: z.string().optional(),
        expertise: z.string().optional(),
        model: z.string().optional(),
        slug: z.string().optional().describe('Lowercase, hyphens, 2-50 chars'),
        tool_config: z
          .string()
          .optional()
          .describe(
            'JSON: {"disabledNativeTools":[], "mcpAccess":{"serverId":["*"]}, "enabledOptInTools":[]}',
          ),
        generate_avatar: z
          .boolean()
          .optional()
          .default(false),
      }),
      execute: async ({ kin_id, name, role, character, expertise, model, slug, tool_config, generate_avatar }) => {
        const targetKinId = resolveKinId(kin_id)
        if (!targetKinId) {
          return { error: `Kin "${kin_id}" not found` }
        }

        if (targetKinId === ctx.kinId) {
          return { error: 'You cannot modify your own configuration. Ask a user or another Kin to do this.' }
        }

        log.info({ kinId: ctx.kinId, targetKinId, targetSlug: kin_id }, 'Kin update requested via tool')

        // Parse tool_config JSON string if provided
        let parsedToolConfig: KinToolConfig | undefined
        if (tool_config) {
          try {
            parsedToolConfig = JSON.parse(tool_config) as KinToolConfig
          } catch {
            return { error: 'Invalid tool_config JSON format' }
          }
        }

        try {
          const result = await updateKin(targetKinId, {
            name,
            role,
            character,
            expertise,
            model,
            slug,
            toolConfig: parsedToolConfig,
          })

          if ('error' in result) {
            return { error: result.error.message }
          }

          const { kin: updated } = result

          let avatarUrl = updated.avatarUrl
          if (generate_avatar) {
            try {
              avatarUrl = await generateAndSaveAvatar(targetKinId)
            } catch {
              // Non-fatal: update succeeded, avatar generation is optional
            }
          }

          return {
            id: updated.id,
            slug: updated.slug,
            name: updated.name,
            role: updated.role,
            model: updated.model,
            avatarUrl,
          }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Failed to update Kin' }
        }
      },
    }),
}

/**
 * delete_kin — permanently delete a Kin and all its data.
 * Opt-in tool: disabled by default.
 */
export const deleteKinTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Permanently delete a Kin and all its data. Irreversible. Cannot delete yourself.',
      inputSchema: z.object({
        kin_id: z.string().describe('Slug or UUID'),
        confirm: z.literal(true).describe('Must be true'),
      }),
      execute: async ({ kin_id, confirm }) => {
        if (!confirm) {
          return { error: 'Deletion must be explicitly confirmed with confirm: true' }
        }

        const targetKinId = resolveKinId(kin_id)
        if (!targetKinId) {
          return { error: `Kin "${kin_id}" not found` }
        }

        if (targetKinId === ctx.kinId) {
          return { error: 'You cannot delete yourself. Ask a user or another Kin to do this.' }
        }

        log.warn({ kinId: ctx.kinId, targetKinId, targetSlug: kin_id }, 'Kin deletion requested via tool')

        try {
          const deleted = await deleteKin(targetKinId)
          if (!deleted) {
            return { error: 'Kin not found' }
          }
          return { success: true, deletedKin: kin_id }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Failed to delete Kin' }
        }
      },
    }),
}

/**
 * get_kin_details — get detailed information about a Kin.
 * Opt-in tool: disabled by default.
 */
export const getKinDetailsTool: ToolRegistration = {
  availability: ['main'],
  defaultDisabled: true,
  create: (ctx) =>
    tool({
      description:
        'Get detailed information about a Kin including config, MCP servers, and tool settings.',
      inputSchema: z.object({
        kin_id: z.string().describe('Slug or UUID'),
      }),
      execute: async ({ kin_id }) => {
        const targetKinId = resolveKinId(kin_id)
        if (!targetKinId) {
          return { error: `Kin "${kin_id}" not found` }
        }

        const details = await getKinDetails(targetKinId)
        if (!details) {
          return { error: 'Kin not found' }
        }

        const toolConfig: KinToolConfig | null = details.toolConfig
          ? JSON.parse(details.toolConfig)
          : null

        return {
          id: details.id,
          slug: details.slug,
          name: details.name,
          role: details.role,
          character: details.character,
          expertise: details.expertise,
          model: details.model,
          mcpServers: details.mcpServers.map((s) => ({ id: s.id, name: s.name })),
          toolConfig,
          createdAt: details.createdAt,
        }
      },
    }),
}
