import { eq, and, not } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { db } from '@/server/db/index'
import {
  kins,
  kinMcpServers,
  mcpServers,
  queueItems,
  compactingSnapshots,
  memories,
  messages,
  contacts,
  contactNotes,
  customTools,
  tasks,
  crons,
  files,
} from '@/server/db/schema'
import { config } from '@/server/config'
import { generateSlug, ensureUniqueSlug, isValidSlug } from '@/server/utils/slug'
import { sseManager } from '@/server/sse/index'
import {
  generateAvatarImage,
  buildAvatarPrompt,
} from '@/server/services/image-generation'
import { createLogger } from '@/server/logger'
import type { KinToolConfig } from '@/shared/types'

const log = createLogger('services:kins')

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateKinInput {
  name: string
  role: string
  character: string
  expertise: string
  model: string
  providerId?: string | null
  createdBy: string
  mcpServerIds?: string[]
}

export interface UpdateKinInput {
  name?: string
  role?: string
  character?: string
  expertise?: string
  model?: string
  providerId?: string | null
  slug?: string
  toolConfig?: KinToolConfig | null
  mcpServerIds?: string[]
}

export interface KinRecord {
  id: string
  slug: string | null
  name: string
  role: string
  avatarPath: string | null
  character: string
  expertise: string
  model: string
  providerId: string | null
  workspacePath: string
  toolConfig: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface KinDetails extends KinRecord {
  avatarUrl: string | null
  mcpServers: Array<{ id: string; name: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function kinAvatarUrl(kinId: string, avatarPath: string | null, updatedAt?: Date | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  const v = updatedAt ? updatedAt.getTime() : Date.now()
  return `/api/uploads/kins/${kinId}/avatar.${ext}?v=${v}`
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createKin(input: CreateKinInput): Promise<KinRecord> {
  const id = uuid()
  const workspacePath = `${config.workspace.baseDir}/${id}`

  // Generate unique slug from name
  const existingSlugs = new Set(
    (await db.select({ slug: kins.slug }).from(kins).all())
      .map((k) => k.slug)
      .filter((s): s is string => s != null),
  )
  const slug = ensureUniqueSlug(generateSlug(input.name) || 'kin', existingSlugs)

  // Create workspace directory
  mkdirSync(workspacePath, { recursive: true })
  mkdirSync(`${workspacePath}/tools`, { recursive: true })

  const now = new Date()
  await db.insert(kins).values({
    id,
    slug,
    name: input.name,
    role: input.role,
    character: input.character,
    expertise: input.expertise,
    model: input.model,
    providerId: input.providerId ?? null,
    workspacePath,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  })

  log.info({ kinId: id, name: input.name, slug }, 'Kin created')

  // Link MCP servers if provided
  if (input.mcpServerIds && input.mcpServerIds.length > 0) {
    for (const mcpServerId of input.mcpServerIds) {
      await db.insert(kinMcpServers).values({ kinId: id, mcpServerId })
    }
  }

  // Broadcast creation — kin:created so clients add the new entry to their list
  sseManager.broadcast({
    type: 'kin:created',
    kinId: id,
    data: {
      kinId: id,
      slug,
      name: input.name,
      role: input.role,
      model: input.model,
      providerId: input.providerId ?? null,
      avatarUrl: null,
      createdAt: now.toISOString(),
    },
  })

  return db.select().from(kins).where(eq(kins.id, id)).get()!
}

// ─── Update ─────────────────────────────────────────────────────────────────

export type UpdateKinError = { code: 'INVALID_SLUG' | 'SLUG_TAKEN'; message: string }

export async function updateKin(
  kinId: string,
  input: UpdateKinInput,
): Promise<{ kin: KinDetails } | { error: UpdateKinError }> {
  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) updates.name = input.name
  if (input.role !== undefined) updates.role = input.role
  if (input.character !== undefined) updates.character = input.character
  if (input.expertise !== undefined) updates.expertise = input.expertise
  if (input.model !== undefined) updates.model = input.model
  if (input.providerId !== undefined) updates.providerId = input.providerId
  if (input.toolConfig !== undefined) updates.toolConfig = JSON.stringify(input.toolConfig)

  // Handle slug update
  if (input.slug !== undefined) {
    const newSlug = input.slug
    if (!isValidSlug(newSlug)) {
      return { error: { code: 'INVALID_SLUG', message: 'Slug must be 2-50 chars, lowercase alphanumeric and hyphens' } }
    }
    const conflict = db
      .select({ id: kins.id })
      .from(kins)
      .where(and(eq(kins.slug, newSlug), not(eq(kins.id, kinId))))
      .get()
    if (conflict) {
      return { error: { code: 'SLUG_TAKEN', message: 'This slug is already in use' } }
    }
    updates.slug = newSlug
  }

  await db.update(kins).set(updates).where(eq(kins.id, kinId))

  // Update MCP server links if provided explicitly
  if (input.mcpServerIds !== undefined) {
    await db.delete(kinMcpServers).where(eq(kinMcpServers.kinId, kinId))
    for (const mcpServerId of input.mcpServerIds) {
      await db.insert(kinMcpServers).values({ kinId, mcpServerId })
    }
  }

  // Auto-sync kinMcpServers links based on toolConfig.mcpAccess
  if (input.toolConfig !== undefined && input.mcpServerIds === undefined) {
    const tc = input.toolConfig
    if (tc?.mcpAccess) {
      const currentLinks = await db
        .select({ mcpServerId: kinMcpServers.mcpServerId })
        .from(kinMcpServers)
        .where(eq(kinMcpServers.kinId, kinId))
        .all()
      const currentSet = new Set(currentLinks.map((l) => l.mcpServerId))

      for (const [serverId, access] of Object.entries(tc.mcpAccess)) {
        if (access.length > 0 && !currentSet.has(serverId)) {
          await db.insert(kinMcpServers).values({ kinId, mcpServerId: serverId })
        }
      }
    }
  }

  const details = await getKinDetails(kinId)
  if (!details) {
    // Should not happen since we just updated it
    throw new Error('Kin not found after update')
  }

  log.debug({ kinId, updatedFields: Object.keys(updates).filter((k) => k !== 'updatedAt') }, 'Kin updated')

  // Notify all clients
  sseManager.broadcast({
    type: 'kin:updated',
    kinId,
    data: { kinId, slug: details.slug, name: details.name, role: details.role, avatarUrl: details.avatarUrl, providerId: details.providerId },
  })

  return { kin: details }
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteKin(kinId: string): Promise<boolean> {
  const existing = db.select().from(kins).where(eq(kins.id, kinId)).get()
  if (!existing) return false

  // Clean up all related records — topological order (leaves first)
  await db.delete(files).where(eq(files.kinId, kinId))
  await db.delete(compactingSnapshots).where(eq(compactingSnapshots.kinId, kinId))
  await db.delete(memories).where(eq(memories.kinId, kinId))
  await db.delete(queueItems).where(eq(queueItems.kinId, kinId))
  await db.delete(messages).where(eq(messages.kinId, kinId))
  await db.update(tasks).set({ parentTaskId: null }).where(eq(tasks.parentKinId, kinId))
  await db.delete(tasks).where(eq(tasks.parentKinId, kinId))
  await db.update(tasks).set({ sourceKinId: null }).where(eq(tasks.sourceKinId, kinId))
  await db.update(crons).set({ targetKinId: null }).where(eq(crons.targetKinId, kinId))
  await db.delete(crons).where(eq(crons.kinId, kinId))
  await db.update(contacts).set({ linkedKinId: null }).where(eq(contacts.linkedKinId, kinId))
  await db.delete(contactNotes).where(eq(contactNotes.kinId, kinId))
  await db.delete(customTools).where(eq(customTools.kinId, kinId))
  await db.delete(kinMcpServers).where(eq(kinMcpServers.kinId, kinId))

  // Delete the kin
  await db.delete(kins).where(eq(kins.id, kinId))

  // Remove workspace directory
  if (existing.workspacePath && existsSync(existing.workspacePath)) {
    rmSync(existing.workspacePath, { recursive: true, force: true })
  }

  log.info({ kinId, name: existing.name, slug: existing.slug }, 'Kin deleted')

  // Notify all clients
  sseManager.broadcast({
    type: 'kin:deleted',
    kinId,
    data: { kinId },
  })

  return true
}

// ─── Get Details ────────────────────────────────────────────────────────────

export async function getKinDetails(kinId: string): Promise<KinDetails | null> {
  const kin = db.select().from(kins).where(eq(kins.id, kinId)).get()
  if (!kin) return null

  const mcpLinks = await db
    .select({ id: mcpServers.id, name: mcpServers.name })
    .from(kinMcpServers)
    .innerJoin(mcpServers, eq(kinMcpServers.mcpServerId, mcpServers.id))
    .where(eq(kinMcpServers.kinId, kinId))
    .all()

  return {
    ...kin,
    avatarUrl: kinAvatarUrl(kinId, kin.avatarPath, kin.updatedAt),
    mcpServers: mcpLinks,
  }
}

// ─── Avatar Generation ──────────────────────────────────────────────────────

export async function generateAndSaveAvatar(kinId: string): Promise<string | null> {
  const kin = db.select().from(kins).where(eq(kins.id, kinId)).get()
  if (!kin) return null

  const prompt = await buildAvatarPrompt({
    name: kin.name,
    role: kin.role,
    character: kin.character ?? '',
    expertise: kin.expertise ?? '',
  })

  const result = await generateAvatarImage(prompt)

  // Determine file extension from media type
  const ext = result.mediaType.includes('png') ? 'png' : 'webp'

  // Save to filesystem
  const avatarDir = `${config.upload.dir}/kins/${kinId}`
  if (!existsSync(avatarDir)) {
    mkdirSync(avatarDir, { recursive: true })
  }
  const filePath = `${avatarDir}/avatar.${ext}`
  const buffer = Buffer.from(result.base64, 'base64')
  await Bun.write(filePath, buffer)

  // Update DB
  await db
    .update(kins)
    .set({ avatarPath: filePath, updatedAt: new Date() })
    .where(eq(kins.id, kinId))

  const avatarUrl = `/api/uploads/kins/${kinId}/avatar.${ext}?v=${Date.now()}`

  // Notify clients
  sseManager.broadcast({
    type: 'kin:updated',
    kinId,
    data: { kinId, avatarUrl },
  })

  log.info({ kinId, avatarUrl }, 'Avatar generated and saved')

  return avatarUrl
}
