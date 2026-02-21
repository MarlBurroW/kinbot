import { Hono } from 'hono'
import { eq, and, not, desc } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { mkdirSync, existsSync, rmSync } from 'fs'
import { db } from '@/server/db/index'
import { kins, kinMcpServers, mcpServers, queueItems, compactingSnapshots, memories, messages, contacts, customTools, tasks, crons, files } from '@/server/db/schema'
import { config } from '@/server/config'
import {
  generateAvatarImage,
  buildAvatarPrompt,
  ImageGenerationError,
} from '@/server/services/image-generation'
import { deleteMemory } from '@/server/services/memory'
import { sseManager } from '@/server/sse/index'
import { generateSlug, ensureUniqueSlug, isValidSlug } from '@/server/utils/slug'
import { resolveKinByIdOrSlug } from '@/server/services/kin-resolver'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:kins')
const kinRoutes = new Hono()

function kinAvatarUrl(kinId: string, avatarPath: string | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  return `/api/uploads/kins/${kinId}/avatar.${ext}`
}

// GET /api/kins — list all kins
kinRoutes.get('/', async (c) => {
  const allKins = await db.select().from(kins).all()

  return c.json({
    kins: allKins.map((k) => ({
      id: k.id,
      slug: k.slug,
      name: k.name,
      role: k.role,
      avatarUrl: kinAvatarUrl(k.id, k.avatarPath),
      model: k.model,
      createdAt: k.createdAt,
    })),
  })
})

// GET /api/kins/:id — get a single kin (accepts UUID or slug)
kinRoutes.get('/:id', async (c) => {
  const kin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!kin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  // Get MCP servers for this kin
  const mcpLinks = await db
    .select({ id: mcpServers.id, name: mcpServers.name })
    .from(kinMcpServers)
    .innerJoin(mcpServers, eq(kinMcpServers.mcpServerId, mcpServers.id))
    .where(eq(kinMcpServers.kinId, kin.id))
    .all()

  // Get queue info
  const pendingItems = await db
    .select()
    .from(queueItems)
    .where(eq(queueItems.kinId, kin.id))
    .all()

  const queueSize = pendingItems.filter((q) => q.status === 'pending').length
  const isProcessing = pendingItems.some((q) => q.status === 'processing')

  return c.json({
    id: kin.id,
    slug: kin.slug,
    name: kin.name,
    role: kin.role,
    avatarUrl: kinAvatarUrl(kin.id, kin.avatarPath),
    character: kin.character,
    expertise: kin.expertise,
    model: kin.model,
    workspacePath: kin.workspacePath,
    mcpServers: mcpLinks,
    queueSize,
    isProcessing,
    createdAt: kin.createdAt,
  })
})

// POST /api/kins — create a new kin
kinRoutes.post('/', async (c) => {
  const user = c.get('user') as { id: string }
  const body = await c.req.json()
  const { name, role, character, expertise, model, mcpServerIds } = body as {
    name: string
    role: string
    character: string
    expertise: string
    model: string
    mcpServerIds?: string[]
  }

  const id = uuid()
  const workspacePath = `${config.workspace.baseDir}/${id}`

  // Generate unique slug from name
  const existingSlugs = new Set(
    (await db.select({ slug: kins.slug }).from(kins).all())
      .map((k) => k.slug)
      .filter((s): s is string => s != null)
  )
  const slug = ensureUniqueSlug(generateSlug(name) || 'kin', existingSlugs)

  // Create workspace directory
  mkdirSync(workspacePath, { recursive: true })
  mkdirSync(`${workspacePath}/tools`, { recursive: true })

  await db.insert(kins).values({
    id,
    slug,
    name,
    role,
    character,
    expertise,
    model,
    workspacePath,
    createdBy: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  log.info({ kinId: id, name, slug }, 'Kin created')

  // Link MCP servers if provided
  if (mcpServerIds && mcpServerIds.length > 0) {
    for (const mcpServerId of mcpServerIds) {
      await db.insert(kinMcpServers).values({ kinId: id, mcpServerId })
    }
  }

  return c.json(
    {
      kin: {
        id,
        slug,
        name,
        role,
        avatarUrl: null,
        character,
        expertise,
        model,
        workspacePath,
        mcpServers: [],
        queueSize: 0,
        isProcessing: false,
        createdAt: new Date(),
      },
    },
    201,
  )
})

// PATCH /api/kins/:id — update a kin (accepts UUID or slug)
kinRoutes.patch('/:id', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const id = existing.id
  const body = await c.req.json()

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name !== undefined) updates.name = body.name
  if (body.role !== undefined) updates.role = body.role
  if (body.character !== undefined) updates.character = body.character
  if (body.expertise !== undefined) updates.expertise = body.expertise
  if (body.model !== undefined) updates.model = body.model

  // Handle slug update
  if (body.slug !== undefined) {
    const newSlug = body.slug as string
    if (!isValidSlug(newSlug)) {
      return c.json({ error: { code: 'INVALID_SLUG', message: 'Slug must be 2-50 chars, lowercase alphanumeric and hyphens' } }, 400)
    }
    const conflict = db.select({ id: kins.id }).from(kins)
      .where(and(eq(kins.slug, newSlug), not(eq(kins.id, id)))).get()
    if (conflict) {
      return c.json({ error: { code: 'SLUG_TAKEN', message: 'This slug is already in use' } }, 409)
    }
    updates.slug = newSlug
  }

  await db.update(kins).set(updates).where(eq(kins.id, id))

  // Update MCP server links if provided
  if (body.mcpServerIds !== undefined) {
    await db.delete(kinMcpServers).where(eq(kinMcpServers.kinId, id))
    for (const mcpServerId of body.mcpServerIds as string[]) {
      await db.insert(kinMcpServers).values({ kinId: id, mcpServerId })
    }
  }

  // Return updated kin
  const updated = await db.select().from(kins).where(eq(kins.id, id)).get()
  const mcpLinks = await db
    .select({ id: mcpServers.id, name: mcpServers.name })
    .from(kinMcpServers)
    .innerJoin(mcpServers, eq(kinMcpServers.mcpServerId, mcpServers.id))
    .where(eq(kinMcpServers.kinId, id))
    .all()

  const kinPayload = {
    id: updated!.id,
    slug: updated!.slug,
    name: updated!.name,
    role: updated!.role,
    avatarUrl: kinAvatarUrl(id, updated!.avatarPath),
    character: updated!.character,
    expertise: updated!.expertise,
    model: updated!.model,
    workspacePath: updated!.workspacePath,
    mcpServers: mcpLinks,
    queueSize: 0,
    isProcessing: false,
    createdAt: updated!.createdAt,
  }

  log.debug({ kinId: id, updatedFields: Object.keys(updates).filter((k) => k !== 'updatedAt') }, 'Kin updated')

  // Notify all clients
  sseManager.broadcast({
    type: 'kin:updated',
    kinId: id,
    data: { kinId: id, slug: kinPayload.slug, name: kinPayload.name, role: kinPayload.role, avatarUrl: kinPayload.avatarUrl },
  })

  return c.json({ kin: kinPayload })
})

// DELETE /api/kins/:id — delete a kin (accepts UUID or slug)
kinRoutes.delete('/:id', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const id = existing.id

  // Clean up all related records — topological order (leaves first)
  // 1. Tables that reference messages
  await db.delete(files).where(eq(files.kinId, id))
  await db.delete(compactingSnapshots).where(eq(compactingSnapshots.kinId, id))
  await db.delete(memories).where(eq(memories.kinId, id))
  // 2. Tables that reference tasks
  await db.delete(queueItems).where(eq(queueItems.kinId, id))
  // 3. Messages (references tasks)
  await db.delete(messages).where(eq(messages.kinId, id))
  // 4. Tasks: break self-reference, then delete
  await db.update(tasks).set({ parentTaskId: null }).where(eq(tasks.parentKinId, id))
  await db.delete(tasks).where(eq(tasks.parentKinId, id))
  // Nullify sourceKinId on tasks belonging to other kins
  await db.update(tasks).set({ sourceKinId: null }).where(eq(tasks.sourceKinId, id))
  // 5. Crons (now safe — no tasks reference them)
  await db.update(crons).set({ targetKinId: null }).where(eq(crons.targetKinId, id))
  await db.delete(crons).where(eq(crons.kinId, id))
  // 6. Remaining kin-owned records
  await db.update(contacts).set({ linkedKinId: null }).where(eq(contacts.linkedKinId, id))
  await db.delete(contacts).where(eq(contacts.kinId, id))
  await db.delete(customTools).where(eq(customTools.kinId, id))
  await db.delete(kinMcpServers).where(eq(kinMcpServers.kinId, id))

  // Delete the kin
  await db.delete(kins).where(eq(kins.id, id))

  // Remove workspace directory
  if (existing.workspacePath && existsSync(existing.workspacePath)) {
    rmSync(existing.workspacePath, { recursive: true, force: true })
  }

  log.info({ kinId: id, name: existing.name, slug: existing.slug }, 'Kin deleted')

  return c.json({ success: true })
})

// POST /api/kins/:id/avatar — upload avatar (accepts UUID or slug)
kinRoutes.post('/:id/avatar', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const id = existing.id

  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return c.json({ error: { code: 'INVALID_FILE', message: 'No file provided' } }, 400)
  }

  const avatarDir = `${config.upload.dir}/kins/${id}`
  if (!existsSync(avatarDir)) {
    mkdirSync(avatarDir, { recursive: true })
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const filename = `avatar.${ext}`
  const filePath = `${avatarDir}/${filename}`
  const buffer = await file.arrayBuffer()
  await Bun.write(filePath, buffer)

  await db
    .update(kins)
    .set({ avatarPath: filePath, updatedAt: new Date() })
    .where(eq(kins.id, id))

  const avatarUrl = `/api/uploads/kins/${id}/avatar.${ext}?v=${Date.now()}`

  // Notify all clients
  sseManager.broadcast({
    type: 'kin:updated',
    kinId: id,
    data: { kinId: id, avatarUrl },
  })

  return c.json({ avatarUrl })
})

// POST /api/kins/:id/avatar/generate — generate avatar preview (accepts UUID or slug)
kinRoutes.post('/:id/avatar/generate', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const id = existing.id

  const body = await c.req.json()
  const mode = body.mode as string

  const prompt =
    mode === 'auto'
      ? await buildAvatarPrompt({
          name: existing.name,
          role: existing.role,
          character: existing.character ?? '',
          expertise: existing.expertise ?? '',
        })
      : body.prompt

  if (mode === 'prompt' && (!prompt || typeof prompt !== 'string')) {
    return c.json(
      { error: { code: 'INVALID_PROMPT', message: 'A prompt is required for prompt mode' } },
      400,
    )
  }

  try {
    const result = await generateAvatarImage(prompt, {
      providerId: body.imageProviderId,
      modelId: body.imageModel,
    })
    return c.json({
      base64: result.base64,
      mediaType: result.mediaType,
    })
  } catch (err) {
    if (err instanceof ImageGenerationError && err.code === 'NO_IMAGE_PROVIDER') {
      return c.json(
        { error: { code: 'NO_IMAGE_PROVIDER', message: err.message } },
        422,
      )
    }
    const message = err instanceof Error ? err.message : 'Image generation failed'
    return c.json(
      { error: { code: 'IMAGE_GENERATION_FAILED', message } },
      502,
    )
  }
})

// ─── Compacting routes ───────────────────────────────────────────────────────

// POST /api/kins/:id/compacting/purge — deactivate active snapshot
kinRoutes.post('/:id/compacting/purge', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = existing.id

  await db
    .update(compactingSnapshots)
    .set({ isActive: false })
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))

  return c.json({ success: true })
})

// GET /api/kins/:id/compacting/snapshots — list snapshots
kinRoutes.get('/:id/compacting/snapshots', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = existing.id

  const snapshots = await db
    .select({
      id: compactingSnapshots.id,
      messagesUpToId: compactingSnapshots.messagesUpToId,
      isActive: compactingSnapshots.isActive,
      createdAt: compactingSnapshots.createdAt,
    })
    .from(compactingSnapshots)
    .where(eq(compactingSnapshots.kinId, kinId))
    .orderBy(desc(compactingSnapshots.createdAt))
    .all()

  return c.json({ snapshots })
})

// POST /api/kins/:id/compacting/rollback — reactivate a previous snapshot
kinRoutes.post('/:id/compacting/rollback', async (c) => {
  const resolvedKin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!resolvedKin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = resolvedKin.id
  const { snapshotId } = (await c.req.json()) as { snapshotId: string }

  const snapshot = await db
    .select()
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.id, snapshotId), eq(compactingSnapshots.kinId, kinId)))
    .get()

  if (!snapshot) {
    return c.json({ error: { code: 'SNAPSHOT_NOT_FOUND', message: 'Snapshot not found' } }, 404)
  }
  if (snapshot.isActive) {
    return c.json({ error: { code: 'ALREADY_ACTIVE', message: 'Snapshot is already active' } }, 400)
  }

  // Deactivate current active snapshot
  await db
    .update(compactingSnapshots)
    .set({ isActive: false })
    .where(and(eq(compactingSnapshots.kinId, kinId), eq(compactingSnapshots.isActive, true)))

  // Reactivate target snapshot
  await db
    .update(compactingSnapshots)
    .set({ isActive: true })
    .where(eq(compactingSnapshots.id, snapshotId))

  return c.json({ success: true })
})

// ─── Memory routes ───────────────────────────────────────────────────────────

// GET /api/kins/:id/memories — list memories
kinRoutes.get('/:id/memories', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = existing.id
  const category = c.req.query('category')
  const subject = c.req.query('subject')
  const limit = Number(c.req.query('limit') ?? 50)

  const conditions = [eq(memories.kinId, kinId)]
  if (category) conditions.push(eq(memories.category, category))
  if (subject) conditions.push(eq(memories.subject, subject))

  const result = await db
    .select({
      id: memories.id,
      content: memories.content,
      category: memories.category,
      subject: memories.subject,
      sourceChannel: memories.sourceChannel,
      createdAt: memories.createdAt,
      updatedAt: memories.updatedAt,
    })
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.updatedAt))
    .limit(limit)
    .all()

  return c.json({ memories: result })
})

// DELETE /api/kins/:id/memories/:memoryId — delete a memory
kinRoutes.delete('/:id/memories/:memoryId', async (c) => {
  const resolvedKin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!resolvedKin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = resolvedKin.id
  const memoryId = c.req.param('memoryId')

  const deleted = await deleteMemory(memoryId, kinId)
  if (!deleted) {
    return c.json({ error: { code: 'MEMORY_NOT_FOUND', message: 'Memory not found' } }, 404)
  }

  return c.json({ success: true })
})

export { kinRoutes }
