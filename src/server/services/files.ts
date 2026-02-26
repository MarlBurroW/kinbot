import { eq, inArray } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { db } from '@/server/db/index'
import { createLogger } from '@/server/logger'
import { files } from '@/server/db/schema'
import { config } from '@/server/config'

const log = createLogger('files')

// ─── Upload ──────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = config.upload.maxFileSizeMb * 1024 * 1024

interface UploadParams {
  kinId: string
  uploadedBy: string
  file: File
}

export async function uploadFile(params: UploadParams) {
  const { kinId, uploadedBy, file } = params

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    log.warn({ fileName: file.name, size: file.size }, 'File upload rejected: too large')
    throw new Error(`File too large: max ${config.upload.maxFileSizeMb} MB`)
  }

  if (file.size === 0) {
    throw new Error('File is empty')
  }

  const id = uuid()
  const ext = getExtension(file.name)
  const storedName = `${id}${ext ? `.${ext}` : ''}`
  const dir = join(config.upload.dir, 'messages', kinId)
  const storedPath = join(dir, storedName)

  // Ensure directory exists
  await mkdir(dir, { recursive: true })

  // Write file to disk
  const buffer = await file.arrayBuffer()
  await Bun.write(storedPath, buffer)

  // Save to DB
  await db.insert(files).values({
    id,
    kinId,
    uploadedBy,
    originalName: file.name,
    storedPath,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date(),
  })

  log.info({ kinId, fileId: id, fileName: file.name, size: file.size, mimeType: file.type }, 'File uploaded')

  return {
    id,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    url: `/api/uploads/messages/${kinId}/${storedName}`,
  }
}

// ─── Link files to a message ─────────────────────────────────────────────────

export async function linkFilesToMessage(fileIds: string[], messageId: string) {
  for (const fileId of fileIds) {
    await db
      .update(files)
      .set({ messageId })
      .where(eq(files.id, fileId))
  }
}

// ─── Get files for a message ─────────────────────────────────────────────────

export async function getFilesForMessage(messageId: string) {
  return db
    .select()
    .from(files)
    .where(eq(files.messageId, messageId))
    .all()
}

// ─── Get files for multiple messages ─────────────────────────────────────────

export async function getFilesForMessages(messageIds: string[]) {
  if (messageIds.length === 0) return new Map<string, typeof files.$inferSelect[]>()

  const matchedFiles = await db
    .select()
    .from(files)
    .where(inArray(files.messageId, messageIds))
    .all()

  const fileMap = new Map<string, typeof files.$inferSelect[]>()
  for (const f of matchedFiles) {
    if (!f.messageId) continue
    const existing = fileMap.get(f.messageId) ?? []
    existing.push(f)
    fileMap.set(f.messageId, existing)
  }

  return fileMap
}

// ─── Serialize file for API response ─────────────────────────────────────────

export function serializeFile(f: typeof files.$inferSelect) {
  const ext = getExtension(f.originalName)
  const storedName = `${f.id}${ext ? `.${ext}` : ''}`
  return {
    id: f.id,
    name: f.originalName,
    mimeType: f.mimeType,
    size: f.size,
    url: `/api/uploads/messages/${f.kinId}/${storedName}`,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()! : ''
}
