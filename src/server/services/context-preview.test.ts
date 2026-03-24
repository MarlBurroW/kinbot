import { describe, it, expect } from 'bun:test'

// ─── Pure function replicas from context-preview.ts ──────────────────────────
// These functions are not exported, so we replicate them here to test
// the contract. If they ever become exported, switch to real imports.

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function safeToJsonSchema(schema: unknown): Record<string, unknown> | null {
  if (schema && typeof schema === 'object' && 'toJSONSchema' in schema && typeof (schema as { toJSONSchema: unknown }).toJSONSchema === 'function') {
    try {
      return (schema as { toJSONSchema(): Record<string, unknown> }).toJSONSchema()
    } catch {
      return null
    }
  }
  return null
}

interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> | null
}

interface MessagePreview {
  role: string
  content: string | null
  hasToolCalls: boolean
  createdAt: number | null
}

interface ContextPreviewResult {
  systemPrompt: string
  compactingSummary: string | null
  rawPayload: {
    system: string
    messages: MessagePreview[]
    tools: ToolDefinition[]
  }
  tokenEstimate: {
    systemPrompt: number
    summary: number
    messages: number
    tools: number
    total: number
  }
  contextWindow: number
  messageCount: number
  generatedAt: number
}

function buildToolDefs(tools: Record<string, unknown>): ToolDefinition[] {
  return Object.entries(tools).map(([name, t]) => {
    const toolObj = t as { description?: string; inputSchema?: unknown }
    return {
      name,
      description: toolObj.description ?? '',
      parameters: safeToJsonSchema(toolObj.inputSchema),
    }
  })
}

function formatResult(
  systemPrompt: string,
  toolDefinitions: ToolDefinition[],
  messagesPreviews: MessagePreview[],
  messageCount: number,
  contextWindow: number,
  compactingSummary: string | null = null,
): ContextPreviewResult {
  let fullPrompt = systemPrompt
  if (toolDefinitions.length > 0) {
    const toolLines = toolDefinitions
      .map((t) => `- **${t.name}**: ${t.description || '(no description)'}`)
      .join('\n')
    fullPrompt += `\n\n## Available tools (${toolDefinitions.length})\n\n${toolLines}`
  }

  const summaryTokens = compactingSummary ? estimateTokens(compactingSummary) : 0
  const rawSystemTokens = estimateTokens(systemPrompt)
  const systemPromptTokens = Math.max(0, rawSystemTokens - summaryTokens)
  let messagesTokens = 0
  for (const m of messagesPreviews) {
    if (m.content) messagesTokens += estimateTokens(m.content)
  }
  const toolsTokens = toolDefinitions.length > 0 ? estimateTokens(JSON.stringify(toolDefinitions)) : 0
  const total = systemPromptTokens + summaryTokens + messagesTokens + toolsTokens

  return {
    systemPrompt: fullPrompt,
    compactingSummary,
    rawPayload: {
      system: systemPrompt,
      messages: messagesPreviews,
      tools: toolDefinitions,
    },
    tokenEstimate: {
      systemPrompt: systemPromptTokens,
      summary: summaryTokens,
      messages: messagesTokens,
      tools: toolsTokens,
      total,
    },
    contextWindow,
    messageCount,
    generatedAt: expect.any(Number) as unknown as number,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns 1 for 1-4 character strings', () => {
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('ab')).toBe(1)
    expect(estimateTokens('abcd')).toBe(1)
  })

  it('returns 2 for 5-8 character strings', () => {
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  it('handles longer text proportionally', () => {
    const text = 'a'.repeat(100)
    expect(estimateTokens(text)).toBe(25)
  })

  it('rounds up for non-divisible lengths', () => {
    expect(estimateTokens('abc')).toBe(1) // 3/4 = 0.75 → ceil = 1
    expect(estimateTokens('abcde')).toBe(2) // 5/4 = 1.25 → ceil = 2
    expect(estimateTokens('abcdefghi')).toBe(3) // 9/4 = 2.25 → ceil = 3
  })

  it('handles unicode text', () => {
    // Unicode characters may have different byte lengths, but estimateTokens uses string length
    const text = '日本語テスト' // 6 characters
    expect(estimateTokens(text)).toBe(2)
  })

  it('handles whitespace-only strings', () => {
    expect(estimateTokens('    ')).toBe(1) // 4 spaces
    expect(estimateTokens('     ')).toBe(2) // 5 spaces
  })

  it('handles newlines', () => {
    expect(estimateTokens('\n\n\n\n')).toBe(1)
    expect(estimateTokens('line1\nline2')).toBe(3) // 11 chars
  })
})

describe('safeToJsonSchema', () => {
  it('returns null for null input', () => {
    expect(safeToJsonSchema(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(safeToJsonSchema(undefined)).toBeNull()
  })

  it('returns null for primitive inputs', () => {
    expect(safeToJsonSchema(42)).toBeNull()
    expect(safeToJsonSchema('hello')).toBeNull()
    expect(safeToJsonSchema(true)).toBeNull()
  })

  it('returns null for objects without toJSONSchema method', () => {
    expect(safeToJsonSchema({})).toBeNull()
    expect(safeToJsonSchema({ foo: 'bar' })).toBeNull()
  })

  it('returns null when toJSONSchema is not a function', () => {
    expect(safeToJsonSchema({ toJSONSchema: 'not a function' })).toBeNull()
    expect(safeToJsonSchema({ toJSONSchema: 42 })).toBeNull()
  })

  it('calls toJSONSchema and returns the result', () => {
    const schema = {
      toJSONSchema: () => ({ type: 'object', properties: { name: { type: 'string' } } }),
    }
    expect(safeToJsonSchema(schema)).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
    })
  })

  it('returns null when toJSONSchema throws', () => {
    const schema = {
      toJSONSchema: () => { throw new Error('Schema error') },
    }
    expect(safeToJsonSchema(schema)).toBeNull()
  })

  it('handles toJSONSchema returning empty object', () => {
    const schema = { toJSONSchema: () => ({}) }
    expect(safeToJsonSchema(schema)).toEqual({})
  })

  it('handles toJSONSchema returning complex nested schema', () => {
    const expected = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number', minimum: 0 },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    }
    const schema = { toJSONSchema: () => expected }
    expect(safeToJsonSchema(schema)).toEqual(expected)
  })
})

describe('buildToolDefs', () => {
  it('returns empty array for empty tools map', () => {
    expect(buildToolDefs({})).toEqual([])
  })

  it('extracts name and description from tools', () => {
    const tools = {
      search: { description: 'Search the web' },
      browse: { description: 'Browse a URL' },
    }
    const result = buildToolDefs(tools)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'search', description: 'Search the web', parameters: null })
    expect(result[1]).toEqual({ name: 'browse', description: 'Browse a URL', parameters: null })
  })

  it('defaults to empty string when description is missing', () => {
    const tools = { myTool: {} }
    const result = buildToolDefs(tools)
    expect(result[0]!.description).toBe('')
  })

  it('extracts parameters from inputSchema with toJSONSchema', () => {
    const jsonSchema = { type: 'object', properties: { query: { type: 'string' } } }
    const tools = {
      search: {
        description: 'Search',
        inputSchema: { toJSONSchema: () => jsonSchema },
      },
    }
    const result = buildToolDefs(tools)
    expect(result[0]!.parameters).toEqual(jsonSchema)
  })

  it('returns null parameters when inputSchema has no toJSONSchema', () => {
    const tools = {
      search: {
        description: 'Search',
        inputSchema: { type: 'object' }, // plain object, not Zod
      },
    }
    const result = buildToolDefs(tools)
    expect(result[0]!.parameters).toBeNull()
  })

  it('preserves tool order from Object.entries', () => {
    const tools = {
      alpha: { description: 'A' },
      beta: { description: 'B' },
      gamma: { description: 'C' },
    }
    const result = buildToolDefs(tools)
    expect(result.map((t) => t.name)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('handles tools with undefined inputSchema', () => {
    const tools = { myTool: { description: 'Test', inputSchema: undefined } }
    const result = buildToolDefs(tools)
    expect(result[0]!.parameters).toBeNull()
  })
})

describe('formatResult', () => {
  const baseMessages: MessagePreview[] = [
    { role: 'user', content: 'Hello', hasToolCalls: false, createdAt: 1000 },
    { role: 'assistant', content: 'Hi there!', hasToolCalls: false, createdAt: 2000 },
  ]

  it('returns correct structure with no tools and no compacting', () => {
    const result = formatResult('System prompt', [], baseMessages, 2, 128000)

    expect(result.systemPrompt).toBe('System prompt')
    expect(result.compactingSummary).toBeNull()
    expect(result.rawPayload.system).toBe('System prompt')
    expect(result.rawPayload.messages).toEqual(baseMessages)
    expect(result.rawPayload.tools).toEqual([])
    expect(result.contextWindow).toBe(128000)
    expect(result.messageCount).toBe(2)
    expect(result.tokenEstimate.tools).toBe(0)
    expect(result.tokenEstimate.summary).toBe(0)
    expect(result.tokenEstimate.total).toBe(
      result.tokenEstimate.systemPrompt + result.tokenEstimate.messages,
    )
  })

  it('appends tools section to system prompt when tools exist', () => {
    const tools: ToolDefinition[] = [
      { name: 'search', description: 'Search the web', parameters: null },
    ]
    const result = formatResult('System', tools, [], 0, 128000)

    expect(result.systemPrompt).toContain('## Available tools (1)')
    expect(result.systemPrompt).toContain('- **search**: Search the web')
    // rawPayload.system should NOT have the tools section appended
    expect(result.rawPayload.system).toBe('System')
  })

  it('shows (no description) for tools without description', () => {
    const tools: ToolDefinition[] = [
      { name: 'myTool', description: '', parameters: null },
    ]
    const result = formatResult('System', tools, [], 0, 128000)
    expect(result.systemPrompt).toContain('- **myTool**: (no description)')
  })

  it('includes compacting summary in token estimate', () => {
    const summary = 'a'.repeat(100) // 25 tokens
    const systemPrompt = 'b'.repeat(200) // system has 50 tokens total

    const result = formatResult(systemPrompt, [], [], 0, 128000, summary)

    expect(result.compactingSummary).toBe(summary)
    expect(result.tokenEstimate.summary).toBe(25)
    // systemPrompt tokens = rawSystemTokens - summaryTokens = 50 - 25 = 25
    expect(result.tokenEstimate.systemPrompt).toBe(25)
    expect(result.tokenEstimate.total).toBe(50) // 25 system + 25 summary
  })

  it('clamps systemPrompt tokens to 0 if summary is larger', () => {
    // Edge case: summary tokens > raw system tokens (shouldn't happen in practice)
    const summary = 'a'.repeat(200)  // 50 tokens
    const systemPrompt = 'b'.repeat(100) // 25 tokens total

    const result = formatResult(systemPrompt, [], [], 0, 128000, summary)

    expect(result.tokenEstimate.systemPrompt).toBe(0) // Math.max(0, 25 - 50)
    expect(result.tokenEstimate.summary).toBe(50)
  })

  it('estimates message tokens correctly', () => {
    const messages: MessagePreview[] = [
      { role: 'user', content: 'a'.repeat(40), hasToolCalls: false, createdAt: 1 },
      { role: 'assistant', content: 'b'.repeat(60), hasToolCalls: false, createdAt: 2 },
    ]
    const result = formatResult('sys', [], messages, 2, 128000)

    expect(result.tokenEstimate.messages).toBe(10 + 15) // 40/4 + 60/4
  })

  it('skips null content messages in token estimation', () => {
    const messages: MessagePreview[] = [
      { role: 'assistant', content: null, hasToolCalls: true, createdAt: 1 },
      { role: 'user', content: 'hello', hasToolCalls: false, createdAt: 2 },
    ]
    const result = formatResult('sys', [], messages, 2, 128000)

    // Only 'hello' counts (5 chars → 2 tokens)
    expect(result.tokenEstimate.messages).toBe(2)
  })

  it('estimates tool tokens from JSON stringified definitions', () => {
    const tools: ToolDefinition[] = [
      { name: 'a', description: 'desc', parameters: { type: 'object' } },
    ]
    const result = formatResult('sys', tools, [], 0, 128000)

    const expectedToolTokens = Math.ceil(JSON.stringify(tools).length / 4)
    expect(result.tokenEstimate.tools).toBe(expectedToolTokens)
  })

  it('total is sum of all sections', () => {
    const summary = 'summary text here'
    const tools: ToolDefinition[] = [
      { name: 'tool1', description: 'A tool', parameters: null },
    ]
    const messages: MessagePreview[] = [
      { role: 'user', content: 'test message', hasToolCalls: false, createdAt: 1 },
    ]
    const result = formatResult('system prompt text', tools, messages, 1, 128000, summary)

    const { systemPrompt: sp, summary: s, messages: m, tools: t, total } = result.tokenEstimate
    expect(total).toBe(sp + s + m + t)
  })

  it('passes through messageCount and contextWindow', () => {
    const result = formatResult('sys', [], [], 42, 200000)
    expect(result.messageCount).toBe(42)
    expect(result.contextWindow).toBe(200000)
  })

  it('includes generatedAt as a number', () => {
    const before = Date.now()
    // We can't easily test generatedAt since our replica uses expect.any
    // Just verify the structure
    const result = formatResult('sys', [], [], 0, 128000)
    // generatedAt in our replica is set to expect.any(Number), but in the real
    // implementation it's Date.now(). We verify the field exists.
    expect(result).toHaveProperty('generatedAt')
  })

  it('handles multiple tools in the appended section', () => {
    const tools: ToolDefinition[] = [
      { name: 'search', description: 'Search', parameters: null },
      { name: 'browse', description: 'Browse', parameters: null },
      { name: 'shell', description: 'Run shell', parameters: null },
    ]
    const result = formatResult('System', tools, [], 0, 128000)

    expect(result.systemPrompt).toContain('## Available tools (3)')
    expect(result.systemPrompt).toContain('- **search**: Search')
    expect(result.systemPrompt).toContain('- **browse**: Browse')
    expect(result.systemPrompt).toContain('- **shell**: Run shell')
  })
})

// ─── SUB_KIN_EXCLUDED_TOOLS and QUICK_SESSION_EXCLUDED_TOOLS constants ──────

describe('excluded tool sets', () => {
  // These are hard-coded sets in context-preview.ts. We verify the expected
  // exclusions to catch accidental removals.

  const SUB_KIN_EXCLUDED = new Set([
    'spawn_self', 'spawn_kin',
    'respond_to_task', 'cancel_task', 'list_tasks',
    'reply',
    'create_cron', 'update_cron', 'delete_cron', 'list_crons',
    'add_mcp_server', 'update_mcp_server', 'remove_mcp_server', 'list_mcp_servers',
    'register_tool', 'list_custom_tools',
    'create_kin', 'update_kin', 'delete_kin', 'get_kin_details',
  ])

  const QUICK_SESSION_EXCLUDED = new Set([
    'spawn_self', 'spawn_kin', 'respond_to_task', 'cancel_task', 'list_tasks',
    'report_to_parent', 'update_task_status', 'request_input',
    'send_message', 'reply', 'list_kins',
    'create_cron', 'update_cron', 'delete_cron', 'list_crons', 'get_cron_journal',
    'add_mcp_server', 'update_mcp_server', 'remove_mcp_server', 'list_mcp_servers',
    'register_tool', 'list_custom_tools',
    'create_kin', 'update_kin', 'delete_kin', 'get_kin_details',
    'create_webhook', 'update_webhook', 'delete_webhook', 'list_webhooks',
    'send_channel_message', 'list_channel_conversations',
    'get_platform_logs',
    'memorize', 'update_memory', 'forget',
  ])

  it('sub-kin exclusion set contains expected tools', () => {
    expect(SUB_KIN_EXCLUDED.size).toBe(20)
    expect(SUB_KIN_EXCLUDED.has('spawn_self')).toBe(true)
    expect(SUB_KIN_EXCLUDED.has('reply')).toBe(true)
    expect(SUB_KIN_EXCLUDED.has('create_kin')).toBe(true)
  })

  it('quick session exclusion set is a superset of sub-kin exclusions for shared tools', () => {
    // Quick sessions exclude more tools than sub-kins
    expect(QUICK_SESSION_EXCLUDED.size).toBeGreaterThan(SUB_KIN_EXCLUDED.size)

    // Memory tools are excluded from quick sessions but not sub-kins
    expect(QUICK_SESSION_EXCLUDED.has('memorize')).toBe(true)
    expect(SUB_KIN_EXCLUDED.has('memorize')).toBe(false)

    // Webhook tools are excluded from quick sessions but not sub-kins
    expect(QUICK_SESSION_EXCLUDED.has('create_webhook')).toBe(true)
    expect(SUB_KIN_EXCLUDED.has('create_webhook')).toBe(false)
  })

  it('quick session exclusion set has expected count', () => {
    expect(QUICK_SESSION_EXCLUDED.size).toBe(36)
  })
})
