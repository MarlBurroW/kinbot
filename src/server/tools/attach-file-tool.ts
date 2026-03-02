import { z } from 'zod'
import { tool } from 'ai'
import { createLogger } from '@/server/logger'
import type { ToolRegistration } from '@/server/tools/types'
import type { OutboundAttachment } from '@/server/channels/adapter'
import { existsSync } from 'fs'
import { resolve, basename, extname } from 'path'

/** Simple MIME type lookup from file extension */
function guessMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf', '.json': 'application/json',
    '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.html': 'text/html', '.xml': 'application/xml',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
    '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.zip': 'application/zip', '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return map[ext] || 'application/octet-stream'
}

const log = createLogger('tools:attach-file')

// ─── Pending attachments store (per Kin, cleared after response delivery) ───

const pendingAttachments = new Map<string, OutboundAttachment[]>()

/**
 * Stage an attachment for the current Kin response.
 * Called by the attach_file tool during a turn.
 */
export function stageAttachment(kinId: string, att: OutboundAttachment): void {
  const existing = pendingAttachments.get(kinId) ?? []
  existing.push(att)
  pendingAttachments.set(kinId, existing)
}

/**
 * Pop all staged attachments for a Kin (consumes them).
 * Called by deliverChannelResponse after the turn completes.
 */
export function popStagedAttachments(kinId: string): OutboundAttachment[] {
  const atts = pendingAttachments.get(kinId) ?? []
  pendingAttachments.delete(kinId)
  return atts
}

/**
 * Clear staged attachments without returning them (e.g. on error/abort).
 */
export function clearStagedAttachments(kinId: string): void {
  pendingAttachments.delete(kinId)
}

// ─── attach_file tool ───────────────────────────────────────────────────────

export const attachFileTool: ToolRegistration = {
  availability: ['main'],
  create: (ctx) =>
    tool({
      description:
        'Attach a file to your current response. The file will be sent alongside your text reply ' +
        'on the messaging platform (Telegram, Discord, WhatsApp, etc.). ' +
        'You can attach a file from your stored files (by URL path like /api/uploads/...), ' +
        'a local workspace file, or an external URL. ' +
        'Call this BEFORE writing your text response. You can call it multiple times to attach several files. ' +
        'Note: attachments are only delivered on channel conversations (Telegram, Discord, etc.), not in the web UI chat.',
      inputSchema: z.object({
        source: z.string().describe(
          'File source: a URL path from generate_image or store_file (e.g. "/api/uploads/messages/..."), ' +
          'a workspace file path, or an external https:// URL',
        ),
        mimeType: z.string().optional().describe(
          'MIME type (e.g. "image/png", "application/pdf"). Auto-detected from file extension if omitted.',
        ),
        fileName: z.string().optional().describe(
          'Display file name for the recipient. Auto-derived from source if omitted.',
        ),
      }),
      execute: async ({ source, mimeType, fileName }) => {
        log.debug({ kinId: ctx.kinId, source }, 'attach_file invoked')

        let resolvedSource = source
        let resolvedMime = mimeType

        // If it's an internal API path, resolve to absolute local path
        if (source.startsWith('/api/uploads/')) {
          const localPath = resolve('data', source.replace(/^\/api\//, ''))
          if (!existsSync(localPath)) {
            return { error: `File not found at ${source}` }
          }
          resolvedSource = localPath
        } else if (source.startsWith('/api/file-storage/')) {
          // file-storage serves from data/file-storage/
          const localPath = resolve('data', source.replace(/^\/api\//, ''))
          if (!existsSync(localPath)) {
            return { error: `File not found at ${source}` }
          }
          resolvedSource = localPath
        } else if (source.startsWith('https://') || source.startsWith('http://')) {
          // External URL — pass through as-is
          resolvedSource = source
        } else {
          // Treat as workspace path — resolve relative to Kin workspace
          const localPath = resolve('data/workspaces', ctx.kinId, source)
          if (!existsSync(localPath)) {
            return { error: `File not found in workspace: ${source}` }
          }
          resolvedSource = localPath
        }

        // Auto-detect MIME if not provided
        if (!resolvedMime) {
          const name = fileName || basename(resolvedSource)
          resolvedMime = guessMimeType(name)
        }

        const attachment: OutboundAttachment = {
          source: resolvedSource,
          mimeType: resolvedMime,
          fileName: fileName || basename(resolvedSource),
        }

        stageAttachment(ctx.kinId, attachment)

        log.info({ kinId: ctx.kinId, fileName: attachment.fileName, mimeType: resolvedMime }, 'File staged for response')

        return {
          success: true,
          message: `File "${attachment.fileName}" staged for delivery. It will be sent with your next response on the messaging platform.`,
          fileName: attachment.fileName,
          mimeType: resolvedMime,
        }
      },
    }),
}
