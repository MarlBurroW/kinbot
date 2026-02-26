import { describe, it, expect } from 'bun:test'
import { buildSystemPrompt } from '@/server/services/prompt-builder'

// Minimal valid params factory
function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    kin: {
      name: 'TestBot',
      slug: 'test-bot',
      role: 'a helpful assistant',
      character: 'Friendly and concise.',
      expertise: 'General knowledge.',
    },
    contacts: [],
    relevantMemories: [],
    kinDirectory: [],
    isSubKin: false,
    userLanguage: 'en' as const,
    ...overrides,
  }
}

describe('buildSystemPrompt', () => {
  // --- Platform context ---

  it('includes platform context block for main agent', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).toContain('## Platform context')
    expect(result).toContain('specialized AI agent (Kin) on KinBot')
    expect(result).toContain('session is continuous and permanent')
    expect(result).toContain('Multiple users may talk to you')
  })

  it('omits platform context block for sub-kins', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Do something',
    }))
    expect(result).not.toContain('## Platform context')
  })

  it('includes kin identity with slug', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).toContain('You are TestBot (slug: test-bot)')
    expect(result).toContain('a helpful assistant')
  })

  it('includes personality and expertise blocks', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).toContain('## Personality')
    expect(result).toContain('Friendly and concise.')
    expect(result).toContain('## Expertise')
    expect(result).toContain('General knowledge.')
  })

  it('omits personality block when empty', () => {
    const result = buildSystemPrompt(makeParams({
      kin: { name: 'Bot', slug: 'bot', role: 'assistant', character: '', expertise: '' },
    }))
    expect(result).not.toContain('## Personality')
    expect(result).not.toContain('## Expertise')
  })

  it('omits slug suffix when slug is null', () => {
    const result = buildSystemPrompt(makeParams({
      kin: { name: 'Bot', slug: null, role: 'assistant', character: '', expertise: '' },
    }))
    expect(result).toContain('You are Bot,')
    expect(result).not.toContain('slug:')
  })

  it('includes contacts when provided', () => {
    const result = buildSystemPrompt(makeParams({
      contacts: [
        { id: 'c1', name: 'Alice', type: 'human', identifierSummary: 'email: alice@test.com' },
      ],
    }))
    expect(result).toContain('## Known contacts')
    expect(result).toContain('Alice')
    expect(result).toContain('email: alice@test.com')
    expect(result).toContain('[id: c1]')
  })

  it('omits contacts section when empty', () => {
    const result = buildSystemPrompt(makeParams({ contacts: [] }))
    expect(result).not.toContain('## Known contacts')
  })

  it('includes relevant memories', () => {
    const result = buildSystemPrompt(makeParams({
      relevantMemories: [
        { category: 'fact', content: 'User likes cats', subject: 'User' },
        { category: 'preference', content: 'Dark mode', subject: null },
      ],
    }))
    expect(result).toContain('## Memories')
    expect(result).toContain('[fact] User likes cats (subject: User)')
    expect(result).toContain('[preference] Dark mode')
    // No subject suffix when null
    expect(result).not.toContain('Dark mode (subject:')
  })

  it('includes kin directory with collaboration instructions for main agent', () => {
    const result = buildSystemPrompt(makeParams({
      kinDirectory: [
        { slug: 'helper', name: 'Helper', role: 'research assistant' },
      ],
    }))
    expect(result).toContain('## Kin directory')
    expect(result).toContain('Helper (slug: helper)')
    expect(result).toContain('### Collaboration and delegation')
    expect(result).toContain('delegate to the most appropriate Kin')
    expect(result).toContain('spawn sub-tasks')
  })

  it('omits kin directory for sub-kins', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Do something',
      kinDirectory: [
        { slug: 'helper', name: 'Helper', role: 'research assistant' },
      ],
    }))
    expect(result).not.toContain('## Kin directory')
  })

  it('sets language to French when userLanguage is fr', () => {
    const result = buildSystemPrompt(makeParams({ userLanguage: 'fr' }))
    expect(result).toContain('You MUST respond in French (fr)')
  })

  it('sets language to English when userLanguage is en', () => {
    const result = buildSystemPrompt(makeParams({ userLanguage: 'en' }))
    expect(result).toContain('You MUST respond in English (en)')
  })

  it('includes date context', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).toContain('Current date and time:')
    expect(result).toContain('Platform: KinBot')
  })

  // --- Initiative ---

  it('includes initiative and proactivity instructions for main agent', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).toContain('### Initiative and proactivity')
    expect(result).toContain('not a passive Q&A bot')
    expect(result).toContain('suggest creating a cron job')
    expect(result).toContain('spawn_self/spawn_kin')
  })

  // --- Sub-Kin prompts ---

  it('builds sub-kin prompt with task description and platform awareness', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Analyze the data and report findings.',
    }))
    expect(result).toContain('specialized AI agent on KinBot')
    expect(result).toContain('executing a delegated task')
    expect(result).toContain('## Your mission')
    expect(result).toContain('Analyze the data and report findings.')
    expect(result).toContain('## Constraints')
    expect(result).toContain('update_task_status()')
  })

  it('sub-kin prompt does not include internal instructions', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Do stuff',
    }))
    expect(result).not.toContain('## Internal instructions')
  })

  it('includes previous cron runs for recurring tasks', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Check metrics',
      previousCronRuns: [
        {
          status: 'completed',
          result: 'All metrics normal',
          createdAt: new Date('2025-01-01T00:00:00Z'),
          updatedAt: new Date('2025-01-01T00:00:30Z'),
        },
        {
          status: 'failed',
          result: null,
          createdAt: new Date('2024-12-31T00:00:00Z'),
          updatedAt: new Date('2024-12-31T00:01:00Z'),
        },
      ],
    }))
    expect(result).toContain('## Previous runs')
    expect(result).toContain('All metrics normal')
    expect(result).toContain('(failed)')
    // Cron journal instruction
    expect(result).toContain('recurring scheduled task')
  })

  it('includes MCP tools block when provided', () => {
    const result = buildSystemPrompt(makeParams({
      mcpTools: [
        {
          serverName: 'weather-server',
          tools: [
            { name: 'get_weather', description: 'Get current weather for a city' },
          ],
        },
      ],
    }))
    expect(result).toContain('## MCP Tools')
    expect(result).toContain('**weather-server**')
    expect(result).toContain('`get_weather`')
  })

  it('includes active channels block', () => {
    const result = buildSystemPrompt(makeParams({
      activeChannels: [
        { platform: 'telegram', name: 'Main Chat' },
        { platform: 'discord', name: 'Dev Server' },
      ],
    }))
    expect(result).toContain('## External channels')
    expect(result).toContain('telegram: "Main Chat"')
    expect(result).toContain('discord: "Dev Server"')
  })

  it('includes global prompt (platform directives)', () => {
    const result = buildSystemPrompt(makeParams({
      globalPrompt: 'Always be polite. Never use profanity.',
    }))
    expect(result).toContain('## Platform directives')
    expect(result).toContain('Always be polite. Never use profanity.')
  })

  it('includes global prompt for sub-kins too', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Do task',
      globalPrompt: 'Be concise.',
    }))
    expect(result).toContain('## Platform directives')
    expect(result).toContain('Be concise.')
  })

  // --- Quick session ---

  it('quick session skips contacts, kin directory, and internal instructions', () => {
    const result = buildSystemPrompt(makeParams({
      isQuickSession: true,
      contacts: [{ id: 'c1', name: 'Alice', type: 'human' }],
      kinDirectory: [{ slug: 'helper', name: 'Helper', role: 'assistant' }],
    }))
    expect(result).toContain('## Quick session')
    expect(result).not.toContain('## Known contacts')
    expect(result).not.toContain('## Kin directory')
    expect(result).not.toContain('## Internal instructions')
  })

  it('quick session includes memories', () => {
    const result = buildSystemPrompt(makeParams({
      isQuickSession: true,
      relevantMemories: [{ category: 'fact', content: 'Important thing', subject: null }],
    }))
    expect(result).toContain('## Memories')
    expect(result).toContain('Important thing')
  })

  // --- Contact formatting ---

  it('formats kin contacts with linked slug', () => {
    const result = buildSystemPrompt(makeParams({
      contacts: [
        { id: 'c1', name: 'HelperBot', type: 'kin', linkedKinSlug: 'helper' },
      ],
    }))
    expect(result).toContain('slug: helper, kin')
  })

  it('formats contacts with linked user name', () => {
    const result = buildSystemPrompt(makeParams({
      contacts: [
        { id: 'c1', name: 'Admin', type: 'human', linkedUserName: 'admin_user' },
      ],
    }))
    expect(result).toContain('system user "admin_user"')
  })
})
