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

  it('includes compact kin directory for sub-kins with inter-kin instructions', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Do something',
      kinDirectory: [
        { slug: 'helper', name: 'Helper', role: 'research assistant' },
      ],
    }))
    expect(result).toContain('## Kin directory')
    expect(result).toContain('Inter-Kin communication')
    expect(result).toContain('Helper (slug: helper)')
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
    expect(result).toContain('Current date:')
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
    expect(result).toContain('## MCP Tools (external servers)')
    expect(result).toContain('**weather-server** (1 tools)')
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

  // --- Current message source ---

  it('includes current message source hint for channel messages', () => {
    const result = buildSystemPrompt(makeParams({
      currentMessageSource: { platform: 'telegram', senderName: 'Nicolas' },
    }))
    expect(result).toContain('Current message from: **telegram**')
    expect(result).toContain('sender: Nicolas')
    expect(result).toContain('Keep moderate length')
  })

  it('includes current message source hint for web UI', () => {
    const result = buildSystemPrompt(makeParams({
      currentMessageSource: { platform: 'web' },
    }))
    expect(result).toContain('Current message from: **web**')
    expect(result).toContain('Full Markdown support')
  })

  it('omits current message source hint when not provided', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).not.toContain('Current message from')
  })

  it('includes discord formatting hints', () => {
    const result = buildSystemPrompt(makeParams({
      currentMessageSource: { platform: 'discord' },
    }))
    expect(result).toContain('No tables')
  })

  // --- Memory grouping ---

  it('groups memories by category when more than 3', () => {
    const memories = [
      { category: 'fact', content: 'Lives in Paris', subject: 'User' },
      { category: 'fact', content: 'Works at Acme', subject: 'User' },
      { category: 'preference', content: 'Likes dark mode', subject: null },
      { category: 'decision', content: 'Use PostgreSQL', subject: null },
    ]
    const result = buildSystemPrompt(makeParams({ relevantMemories: memories }))
    expect(result).toContain('### Facts')
    expect(result).toContain('### Preferences')
    expect(result).toContain('### Decisions')
  })

  it('renders flat list when 3 or fewer memories', () => {
    const memories = [
      { category: 'fact', content: 'Lives in Paris', subject: null },
      { category: 'preference', content: 'Likes dark mode', subject: null },
    ]
    const result = buildSystemPrompt(makeParams({ relevantMemories: memories }))
    expect(result).toContain('## Memories')
    expect(result).not.toContain('### Facts')
  })

  // --- Subject-grouped memories ---

  it('groups memories by subject when ≥60% have subjects', () => {
    const memories = [
      { category: 'fact', content: 'Lives in Paris', subject: 'Alice' },
      { category: 'preference', content: 'Likes coffee', subject: 'Alice' },
      { category: 'fact', content: 'Works at Acme', subject: 'Bob' },
      { category: 'decision', content: 'Use TypeScript', subject: 'Project' },
      { category: 'preference', content: 'Dark mode', subject: null },
    ]
    const result = buildSystemPrompt(makeParams({ relevantMemories: memories }))
    // Subject grouping: headers are subject names, not category labels
    expect(result).toContain('### Alice')
    expect(result).toContain('### Bob')
    expect(result).toContain('### Project')
    expect(result).toContain('### General') // null subject → General
    expect(result).not.toContain('### Facts')
  })

  it('falls back to category grouping when <60% have subjects', () => {
    const memories = [
      { category: 'fact', content: 'Lives in Paris', subject: 'Alice' },
      { category: 'preference', content: 'Likes dark mode', subject: null },
      { category: 'fact', content: 'Has a cat', subject: null },
      { category: 'decision', content: 'Use PostgreSQL', subject: null },
    ]
    const result = buildSystemPrompt(makeParams({ relevantMemories: memories }))
    // Only 25% have subjects → category grouping
    expect(result).toContain('### Facts')
    expect(result).toContain('### Preferences')
    expect(result).not.toContain('### Alice')
  })

  // --- High importance memories ---

  it('marks high importance memories with ★', () => {
    const memories = [
      { category: 'fact', content: 'Important fact', subject: null, importance: 8 },
      { category: 'fact', content: 'Normal fact', subject: null, importance: 5 },
    ]
    const result = buildSystemPrompt(makeParams({ relevantMemories: memories }))
    expect(result).toContain('★')
    expect(result).toContain('★ [fact] Important fact')
    expect(result).not.toContain('★ [fact] Normal fact')
  })

  // --- Hub Kin directory ---

  it('includes hub view kin directory with routing instructions', () => {
    const result = buildSystemPrompt(makeParams({
      isHub: true,
      hubKinDirectory: [
        {
          slug: 'coder',
          name: 'Coder',
          role: 'software engineer',
          expertiseSummary: 'Python, TypeScript, DevOps',
          activeChannels: ['discord', 'telegram'],
        },
        {
          slug: 'writer',
          name: 'Writer',
          role: 'content writer',
          expertiseSummary: 'Blog posts, documentation',
        },
      ],
    }))
    expect(result).toContain('## Kin directory (Hub view)')
    expect(result).toContain('central coordinator')
    expect(result).toContain('### Routing behavior')
    expect(result).toContain('**Coder** (slug: coder)')
    expect(result).toContain('Expertise: Python, TypeScript, DevOps')
    expect(result).toContain('Connected channels: discord, telegram')
    expect(result).toContain('**Writer** (slug: writer)')
    // Writer entry should NOT have "Connected channels" line (no activeChannels)
    // Extract just the Writer block and verify no "Connected channels" in it
    const writerSection = result.split('**Writer**')[1]?.split('\n\n')[0] ?? ''
    expect(writerSection).not.toContain('Connected channels')
    // Should NOT include the standard kin directory block
    expect(result).not.toContain('### Collaboration and delegation')
  })

  it('prefers hub directory over standard directory when isHub is true', () => {
    const result = buildSystemPrompt(makeParams({
      isHub: true,
      hubKinDirectory: [
        { slug: 'helper', name: 'Helper', role: 'assistant', expertiseSummary: 'General' },
      ],
      kinDirectory: [
        { slug: 'helper', name: 'Helper', role: 'assistant' },
      ],
    }))
    expect(result).toContain('## Kin directory (Hub view)')
    expect(result).not.toContain('### Collaboration and delegation')
  })

  // --- Participants ---

  it('includes participants block for group conversation', () => {
    const now = new Date()
    const result = buildSystemPrompt(makeParams({
      participants: [
        { name: 'Alice', platform: 'telegram', messageCount: 5, lastSeenAt: now },
        { name: 'Bob', platform: 'discord', messageCount: 3, lastSeenAt: now },
      ],
    }))
    expect(result).toContain('## Active participants')
    expect(result).toContain('**group conversation**')
    expect(result).toContain('2 participants')
    expect(result).toContain('Alice via telegram')
    expect(result).toContain('Bob via discord')
  })

  it('detects one-on-one conversation with single participant', () => {
    const now = new Date()
    const result = buildSystemPrompt(makeParams({
      participants: [
        { name: 'Alice', platform: 'web', messageCount: 10, lastSeenAt: now },
      ],
    }))
    expect(result).toContain('**one-on-one conversation** with Alice')
    expect(result).not.toContain('group conversation')
  })

  it('treats same person from multiple platforms as one-on-one', () => {
    const now = new Date()
    const result = buildSystemPrompt(makeParams({
      participants: [
        { name: 'Alice', platform: 'telegram', messageCount: 3, lastSeenAt: now },
        { name: 'Alice', platform: 'discord', messageCount: 2, lastSeenAt: now },
      ],
    }))
    // Same name = 1 unique participant → one-on-one
    expect(result).toContain('**one-on-one conversation**')
  })

  it('omits participants section when empty', () => {
    const result = buildSystemPrompt(makeParams({ participants: [] }))
    expect(result).not.toContain('## Active participants')
  })

  // --- Conversation state ---

  it('includes conversation state for full history', () => {
    const result = buildSystemPrompt(makeParams({
      conversationState: {
        visibleMessageCount: 42,
        totalMessageCount: 42,
        hasCompactedHistory: false,
      },
    }))
    expect(result).toContain('## Conversation state')
    expect(result).toContain('full conversation history: 42 messages')
    // Conversation state block should NOT suggest search_history for non-compacted
    expect(result).toContain('## Conversation state')
    expect(result).not.toContain('If you need details from before your visible history')
  })

  it('includes conversation state for compacted history', () => {
    const result = buildSystemPrompt(makeParams({
      conversationState: {
        visibleMessageCount: 20,
        totalMessageCount: 150,
        hasCompactedHistory: true,
      },
    }))
    expect(result).toContain('130 older messages have been summarized')
    expect(result).toContain('20 most recent messages')
    expect(result).toContain('search_history()')
  })

  it('uses singular for 1 compacted message', () => {
    const result = buildSystemPrompt(makeParams({
      conversationState: {
        visibleMessageCount: 10,
        totalMessageCount: 11,
        hasCompactedHistory: true,
      },
    }))
    expect(result).toContain('1 older message has been summarized')
  })

  it('omits conversation state when not provided', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).not.toContain('## Conversation state')
  })

  // --- Compacting summary ---

  it('includes compacting summary when provided', () => {
    const result = buildSystemPrompt(makeParams({
      compactingSummary: 'User discussed project setup and database migration.',
    }))
    expect(result).toContain('## Previous conversation summary')
    expect(result).toContain('User discussed project setup and database migration.')
    expect(result).toContain('faithful summary')
  })

  it('includes compacted timestamp when provided', () => {
    const result = buildSystemPrompt(makeParams({
      compactingSummary: 'Earlier discussion.',
      compactedUpTo: new Date('2025-06-15T10:00:00Z'),
    }))
    expect(result).toContain('## Previous conversation summary')
    expect(result).toContain('Jun 15, 2025')
  })

  it('omits compacting summary when not provided', () => {
    const result = buildSystemPrompt(makeParams())
    expect(result).not.toContain('## Previous conversation summary')
  })

  // --- Cron run result truncation ---

  it('truncates long cron run results to 500 chars', () => {
    const longResult = 'x'.repeat(600)
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Recurring task',
      previousCronRuns: [
        {
          status: 'completed',
          result: longResult,
          createdAt: new Date('2025-01-01T00:00:00Z'),
          updatedAt: new Date('2025-01-01T00:01:00Z'),
        },
      ],
    }))
    expect(result).toContain('## Previous runs')
    // Should contain truncated result (500 chars + ...)
    expect(result).toContain('x'.repeat(500) + '...')
    expect(result).not.toContain('x'.repeat(501))
  })

  it('does not truncate short cron run results', () => {
    const shortResult = 'All good'
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Check stuff',
      previousCronRuns: [
        {
          status: 'completed',
          result: shortResult,
          createdAt: new Date('2025-01-01T00:00:00Z'),
          updatedAt: new Date('2025-01-01T00:00:30Z'),
        },
      ],
    }))
    expect(result).toContain('All good')
    expect(result).not.toContain('...')
  })

  it('shows execution time in seconds for cron runs', () => {
    const result = buildSystemPrompt(makeParams({
      isSubKin: true,
      taskDescription: 'Task',
      previousCronRuns: [
        {
          status: 'completed',
          result: 'Done',
          createdAt: new Date('2025-01-01T00:00:00Z'),
          updatedAt: new Date('2025-01-01T00:00:45Z'),
        },
      ],
    }))
    expect(result).toContain('(45s)')
  })

  // --- WhatsApp formatting hint ---

  it('includes whatsapp formatting hints', () => {
    const result = buildSystemPrompt(makeParams({
      currentMessageSource: { platform: 'whatsapp' },
    }))
    expect(result).toContain('Very limited formatting')
  })

  // --- Quick session with global prompt ---

  it('quick session includes global prompt', () => {
    const result = buildSystemPrompt(makeParams({
      isQuickSession: true,
      globalPrompt: 'Always sign off with a smiley.',
    }))
    expect(result).toContain('## Platform directives')
    expect(result).toContain('Always sign off with a smiley.')
    expect(result).toContain('## Quick session')
  })
})
