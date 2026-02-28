import { Hono } from 'hono'
import { eq, and, desc, isNull, ne } from 'drizzle-orm'
import { mkdirSync, existsSync } from 'fs'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { db } from '@/server/db/index'
import { kins, kinMcpServers, mcpServers, queueItems, compactingSnapshots, memories, messages, providers } from '@/server/db/schema'
import { config } from '@/server/config'
import {
  generateAvatarImage,
  buildAvatarPrompt,
  ImageGenerationError,
  findLLMProvider,
} from '@/server/services/image-generation'
import { decrypt } from '@/server/services/encryption'
import { deleteMemory, createMemory, updateMemory } from '@/server/services/memory'
import { getMCPToolsForConfig } from '@/server/services/mcp'
import { toolRegistry } from '@/server/tools/index'
import { TOOL_DOMAIN_MAP, TOOL_DOMAIN_META } from '@/shared/constants'
import type { KinToolConfig, ToolDomain, MemoryCategory } from '@/shared/types'
import { sseManager } from '@/server/sse/index'
import { resolveKinByIdOrSlug } from '@/server/services/kin-resolver'
import {
  createKin,
  updateKin,
  deleteKin,
  getKinDetails,
  kinAvatarUrl,
} from '@/server/services/kins'
import { listModelsForProvider } from '@/server/providers/index'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'
import { getModelContextWindow } from '@/shared/model-context-windows'

const log = createLogger('routes:kins')
const kinRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/kins — list all kins
kinRoutes.get('/', async (c) => {
  const allKins = await db.select().from(kins).all()

  return c.json({
    kins: allKins.map((k) => ({
      id: k.id,
      slug: k.slug,
      name: k.name,
      role: k.role,
      avatarUrl: kinAvatarUrl(k.id, k.avatarPath, k.updatedAt),
      model: k.model,
      providerId: k.providerId ?? null,
      createdAt: k.createdAt,
    })),
  })
})

// ─── Wizard: AI-assisted Kin configuration ─────────────────────────────────
// These routes MUST be registered before /:id to avoid being caught by the wildcard

// POST /api/kins/generate-config — generate Kin configuration from natural language
kinRoutes.post('/generate-config', async (c) => {
  const body = await c.req.json()
  const { description, refinement, currentConfig, language } = body as {
    description?: string
    refinement?: string
    currentConfig?: Record<string, unknown>
    language?: string
  }

  if (!description && !refinement) {
    return c.json(
      { error: { code: 'INVALID_REQUEST', message: 'Either description or refinement is required' } },
      400,
    )
  }

  // Find a fast LLM provider (same pattern as buildAvatarPrompt)
  const llmProvider = await findLLMProvider()
  if (!llmProvider) {
    return c.json(
      { error: { code: 'NO_LLM_PROVIDER', message: 'No LLM provider configured' } },
      422,
    )
  }

  const providerConfig = JSON.parse(await decrypt(llmProvider.configEncrypted)) as {
    apiKey: string
    baseUrl?: string
  }

  let model
  if (llmProvider.type === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = anthropic('claude-haiku-4-5-20251001')
  } else if (llmProvider.type === 'anthropic-oauth') {
    const { getOAuthAccessToken, OAUTH_HEADERS } = await import('@/server/providers/anthropic-oauth')
    const accessToken = await getOAuthAccessToken(llmProvider.id)
    const anthropic = createAnthropic({ apiKey: accessToken, headers: OAUTH_HEADERS })
    model = anthropic('claude-haiku-4-5-20251001')
  } else if (llmProvider.type === 'openai') {
    const openai = createOpenAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = openai('gpt-4o-mini')
  } else if (llmProvider.type === 'gemini') {
    const google = createGoogleGenerativeAI({ apiKey: providerConfig.apiKey, baseURL: providerConfig.baseUrl })
    model = google('gemini-2.0-flash')
  } else {
    return c.json(
      { error: { code: 'UNSUPPORTED_PROVIDER', message: 'No supported LLM provider found' } },
      422,
    )
  }

  // Collect available LLM model IDs for the suggestion
  const allProviders = await db.select().from(providers).all()
  const availableModels: string[] = []
  for (const p of allProviders) {
    if (!p.isValid) continue
    try {
      const pConfig = JSON.parse(await decrypt(p.configEncrypted))
      const pModels = await listModelsForProvider(p.type, pConfig)
      for (const m of pModels) {
        if (m.capability === 'llm' && !availableModels.includes(m.id)) {
          availableModels.push(m.id)
        }
      }
    } catch {
      // Skip provider on error
    }
  }

  // Build tool domain descriptions for the LLM
  const toolDomains = Object.keys(TOOL_DOMAIN_META).map((d) => d).join(', ')

  const lang = language === 'fr' ? 'French' : 'English'

  const systemPrompt = `You are a configuration generator for an AI assistant platform called KinBot. A "Kin" is a specialized AI assistant with a unique identity, personality, and expertise.

Given a user's description of the assistant they want, generate a complete Kin configuration as JSON.

## Fields to generate

- **name**: A short, memorable name for the Kin (1-3 words). Creative but professional.
- **role**: A concise role description (5-15 words) that summarizes the Kin's purpose.
- **character**: A detailed personality description (markdown, 3-5 paragraphs). Defines the tone, communication style, behavior, and values. Use "Tu" (informal) if French, "You" if English. Should feel like a real personality, not generic.
- **expertise**: A detailed knowledge description (markdown, 3-5 paragraphs with bullet lists). Defines specific knowledge domains, methodologies, and objectives. Be concrete and specific to the domain.
- **suggestedModel**: One of the available model IDs. Pick the most capable model for the task (prefer Claude or GPT-4 class for complex domains, lighter models for simple assistants).
- **disableToolDomains**: Array of tool domain names to DISABLE (the Kin won't need these). Most Kins don't need all tools. Be selective — only disable tools clearly irrelevant to the domain.
- **enableOptInToolDomains**: Array of opt-in tool domains to ENABLE. Currently only "kin-management" and "system" are opt-in. Only enable these for admin/platform-management Kins.

## Available tool domains
${toolDomains}

Domain descriptions:
- search: Web search capabilities
- browse: Browse URLs, extract content, take screenshots
- contacts: Manage contact records
- memory: Store and recall long-term memories
- vault: Secure secret storage
- tasks: Spawn sub-tasks and manage delegated work
- inter-kin: Communicate with other Kins on the platform
- crons: Schedule recurring jobs
- custom: Create and run custom scripts
- images: Generate images
- shell: Execute shell commands
- file-storage: Store and manage files
- mcp: Manage MCP (Model Context Protocol) servers
- kin-management: Create/update/delete other Kins (opt-in, admin only)
- webhooks: Manage incoming/outgoing webhooks
- channels: Manage external messaging channels (Telegram, Discord)
- system: Access platform logs (opt-in, admin only)
- users: Manage platform users

## Available LLM models
${availableModels.join(', ')}

## Rules
- Generate ALL content in ${lang}
- Output ONLY valid JSON, nothing else — no markdown fences, no comments
- The character and expertise fields should be rich, specific, and tailored to the domain
- Do not include generic filler — every sentence should be relevant to the specific domain
- For disableToolDomains, think about what tools are NOT useful for this type of assistant. For example, a legal advisor doesn't need "images" or "shell", while a code expert would want "shell" enabled.
- Always keep "memory", "tasks", "inter-kin" enabled (don't add them to disableToolDomains) as these are useful for all Kins.

## Output JSON schema
{
  "name": "string",
  "role": "string",
  "character": "string (markdown)",
  "expertise": "string (markdown)",
  "suggestedModel": "string (model ID)",
  "disableToolDomains": ["string"],
  "enableOptInToolDomains": ["string"]
}`

  let userPrompt: string
  if (refinement && currentConfig) {
    userPrompt = `Current configuration:
${JSON.stringify(currentConfig, null, 2)}

Refinement request: ${refinement}

Update the configuration based on the refinement request. Keep fields that don't need changing. Output the full updated configuration as JSON.`
  } else {
    userPrompt = `User description: ${description}

Generate the complete Kin configuration as JSON.`
  }

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
    })

    // Parse JSON from response (handle potential markdown fences)
    let jsonText = result.text.trim()
    const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch?.[1]) {
      jsonText = fenceMatch[1].trim()
    }

    const generatedConfig = JSON.parse(jsonText)

    return c.json({ config: generatedConfig })
  } catch (err) {
    log.error({ err }, 'Failed to generate Kin configuration')
    const message = err instanceof Error ? err.message : 'Configuration generation failed'
    return c.json(
      { error: { code: 'GENERATION_FAILED', message } },
      502,
    )
  }
})

// POST /api/kins/avatar/preview — generate avatar preview without a kinId (for wizard)
kinRoutes.post('/avatar/preview', async (c) => {
  const body = await c.req.json()
  const { name, role, character, expertise, imageProviderId, imageModel } = body as {
    name: string
    role: string
    character?: string
    expertise?: string
    imageProviderId?: string
    imageModel?: string
  }

  if (!name || !role) {
    return c.json(
      { error: { code: 'INVALID_REQUEST', message: 'Name and role are required' } },
      400,
    )
  }

  try {
    const prompt = await buildAvatarPrompt({
      name,
      role,
      character: character ?? '',
      expertise: expertise ?? '',
    })

    const result = await generateAvatarImage(prompt, {
      providerId: imageProviderId,
      modelId: imageModel,
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
    const message = err instanceof Error ? err.message : 'Avatar generation failed'
    return c.json(
      { error: { code: 'AVATAR_GENERATION_FAILED', message } },
      502,
    )
  }
})

// GET /api/kins/:id/context-usage — lightweight context token estimation
kinRoutes.get('/:id/context-usage', async (c) => {
  const kin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!kin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const contextWindow = getModelContextWindow(kin.model)

  // Rough token estimation: ~4 chars per token
  const estimateTokens = (text: string) => Math.ceil(text.length / 4)

  let contextTokens = 0

  // System prompt baseline: kin fields + overhead for tools/memories/formatting
  contextTokens += estimateTokens([kin.name, kin.role, kin.character, kin.expertise].join(' '))
  contextTokens += 1500 // baseline overhead for prompt template, tools, memories, etc.

  // Compacted summary (if any)
  const snapshot = await db
    .select({ summary: compactingSnapshots.summary, createdAt: compactingSnapshots.createdAt })
    .from(compactingSnapshots)
    .where(and(eq(compactingSnapshots.kinId, kin.id), eq(compactingSnapshots.isActive, true)))
    .get()

  if (snapshot) {
    contextTokens += estimateTokens(snapshot.summary)
  }

  // Recent messages (same logic as buildMessageHistory in kin-engine)
  const recentMsgs = await db
    .select({ content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.kinId, kin.id),
        isNull(messages.taskId),
        isNull(messages.sessionId),
        ne(messages.sourceType, 'compacting'),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(50)
    .all()

  const filtered = snapshot
    ? recentMsgs.filter((m) => m.createdAt && snapshot.createdAt && m.createdAt > snapshot.createdAt)
    : recentMsgs

  for (const msg of filtered) {
    if (msg.content) contextTokens += estimateTokens(msg.content)
  }

  return c.json({ contextTokens, contextWindow })
})

// ─── Kin CRUD (parameterized routes) ───────────────────────────────────────

// GET /api/kins/:id — get a single kin (accepts UUID or slug)
kinRoutes.get('/:id', async (c) => {
  const kin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!kin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const details = await getKinDetails(kin.id)
  if (!details) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  // Get queue info
  const pendingItems = await db
    .select()
    .from(queueItems)
    .where(eq(queueItems.kinId, kin.id))
    .all()

  const queueSize = pendingItems.filter((q) => q.status === 'pending').length
  const isProcessing = pendingItems.some((q) => q.status === 'processing')

  return c.json({
    id: details.id,
    slug: details.slug,
    name: details.name,
    role: details.role,
    avatarUrl: details.avatarUrl,
    character: details.character,
    expertise: details.expertise,
    model: details.model,
    providerId: details.providerId ?? null,
    workspacePath: details.workspacePath,
    toolConfig: details.toolConfig ? JSON.parse(details.toolConfig) : null,
    mcpServers: details.mcpServers,
    queueSize,
    isProcessing,
    createdAt: details.createdAt,
  })
})

// POST /api/kins — create a new kin
kinRoutes.post('/', async (c) => {
  const user = c.get('user') as { id: string }
  const body = await c.req.json()
  const { name, role, character, expertise, model, providerId, mcpServerIds } = body as {
    name: string
    role: string
    character: string
    expertise: string
    model: string
    providerId?: string | null
    mcpServerIds?: string[]
  }

  const newKin = await createKin({
    name,
    role,
    character,
    expertise,
    model,
    providerId,
    createdBy: user.id,
    mcpServerIds,
  })

  return c.json(
    {
      kin: {
        id: newKin.id,
        slug: newKin.slug,
        name: newKin.name,
        role: newKin.role,
        avatarUrl: null,
        character: newKin.character,
        expertise: newKin.expertise,
        model: newKin.model,
        providerId: newKin.providerId ?? null,
        workspacePath: newKin.workspacePath,
        mcpServers: [],
        queueSize: 0,
        isProcessing: false,
        createdAt: newKin.createdAt,
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

  const body = await c.req.json()
  const result = await updateKin(existing.id, {
    name: body.name,
    role: body.role,
    character: body.character,
    expertise: body.expertise,
    model: body.model,
    providerId: body.providerId,
    slug: body.slug,
    toolConfig: body.toolConfig,
    mcpServerIds: body.mcpServerIds,
  })

  if ('error' in result) {
    const statusCode = result.error.code === 'INVALID_SLUG' ? 400 : 409
    return c.json({ error: result.error }, statusCode)
  }

  const { kin: details } = result
  return c.json({
    kin: {
      id: details.id,
      slug: details.slug,
      name: details.name,
      role: details.role,
      avatarUrl: details.avatarUrl,
      character: details.character,
      expertise: details.expertise,
      model: details.model,
      providerId: details.providerId ?? null,
      workspacePath: details.workspacePath,
      toolConfig: details.toolConfig ? JSON.parse(details.toolConfig) : null,
      mcpServers: details.mcpServers,
      queueSize: 0,
      isProcessing: false,
      createdAt: details.createdAt,
    },
  })
})

// DELETE /api/kins/:id — delete a kin (accepts UUID or slug)
kinRoutes.delete('/:id', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const deleted = await deleteKin(existing.id)
  if (!deleted) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

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

// ─── Tool authorization routes ────────────────────────────────────────────────

// GET /api/kins/:id/tools — list all available tools with enabled/disabled state
kinRoutes.get('/:id/tools', async (c) => {
  const kin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!kin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const toolConfig: KinToolConfig | null = kin.toolConfig
    ? JSON.parse(kin.toolConfig)
    : null

  // Native tools grouped by domain
  const allNative = toolRegistry.list()
  const domainGroupsMap = new Map<ToolDomain, Array<{ name: string; enabled: boolean; defaultDisabled: boolean }>>()

  for (const t of allNative) {
    const domain = TOOL_DOMAIN_MAP[t.name]
    if (!domain) continue
    if (!domainGroupsMap.has(domain)) domainGroupsMap.set(domain, [])

    // Compute enabled state based on opt-in vs deny-list model
    let enabled: boolean
    if (t.defaultDisabled) {
      // Opt-in tool: enabled only if explicitly listed in enabledOptInTools
      enabled = toolConfig?.enabledOptInTools?.includes(t.name) ?? false
    } else {
      // Standard tool: enabled unless in disabledNativeTools
      enabled = !toolConfig?.disabledNativeTools?.includes(t.name)
    }

    domainGroupsMap.get(domain)!.push({ name: t.name, enabled, defaultDisabled: t.defaultDisabled })
  }

  const nativeTools = Array.from(domainGroupsMap.entries()).map(([domain, tools]) => ({
    domain,
    tools,
  }))

  // MCP tools with enabled state
  const mcpTools = await getMCPToolsForConfig(kin.id, toolConfig)

  log.debug({ kinId: kin.id, nativeCount: nativeTools.length, mcpCount: mcpTools.length }, 'GET /tools response')

  return c.json({ nativeTools, mcpTools })
})

// ─── Compacting routes ───────────────────────────────────────────────────────

// POST /api/kins/:id/compacting/run — force compaction immediately
kinRoutes.post('/:id/compacting/run', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }

  const { runCompacting } = await import('@/server/services/compacting')
  const result = await runCompacting(existing.id)
  if (!result) {
    return c.json({ error: { code: 'NOTHING_TO_COMPACT', message: 'Not enough messages to compact' } }, 422)
  }

  return c.json({ success: true, summary: result.summary, memoriesExtracted: result.memoriesExtracted })
})

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

// POST /api/kins/:id/memories — create a memory
kinRoutes.post('/:id/memories', async (c) => {
  const existing = resolveKinByIdOrSlug(c.req.param('id'))
  if (!existing) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = existing.id
  const { content, category, subject } = (await c.req.json()) as {
    content: string
    category: string
    subject?: string
  }

  if (!content || !category) {
    return c.json(
      { error: { code: 'INVALID_INPUT', message: 'Content and category are required' } },
      400,
    )
  }

  const memory = await createMemory(kinId, {
    content,
    category: category as MemoryCategory,
    subject: subject ?? null,
    sourceChannel: 'explicit',
  })

  return c.json({
    memory: {
      id: memory!.id,
      kinId: memory!.kinId,
      content: memory!.content,
      category: memory!.category,
      subject: memory!.subject,
      sourceChannel: memory!.sourceChannel,
      createdAt: memory!.createdAt,
      updatedAt: memory!.updatedAt,
    },
  }, 201)
})

// PATCH /api/kins/:id/memories/:memoryId — update a memory
kinRoutes.patch('/:id/memories/:memoryId', async (c) => {
  const resolvedKin = resolveKinByIdOrSlug(c.req.param('id'))
  if (!resolvedKin) {
    return c.json({ error: { code: 'KIN_NOT_FOUND', message: 'Kin not found' } }, 404)
  }
  const kinId = resolvedKin.id
  const memoryId = c.req.param('memoryId')
  const body = (await c.req.json()) as {
    content?: string
    category?: string
    subject?: string | null
  }

  const updated = await updateMemory(memoryId, kinId, {
    content: body.content,
    category: body.category as MemoryCategory | undefined,
    subject: body.subject,
  })

  if (!updated) {
    return c.json({ error: { code: 'MEMORY_NOT_FOUND', message: 'Memory not found' } }, 404)
  }

  return c.json({
    memory: {
      id: updated.id,
      kinId: updated.kinId,
      content: updated.content,
      category: updated.category,
      subject: updated.subject,
      sourceChannel: updated.sourceChannel,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  })
})

export { kinRoutes }
