import { describe, test, expect, beforeEach } from 'bun:test'
import createPlugin from './index'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(config: Record<string, string> = {}) {
  return {
    config: { maxEvents: '500', defaultReminderMinutes: '15', ...config },
    manifest: { name: `test-cal-${Date.now()}-${Math.random()}` },
    log: { info: () => {} },
  }
}

async function executeTool(
  plugin: ReturnType<typeof createPlugin>,
  toolName: string,
  input: any = {},
) {
  const toolDef = (plugin.tools as any)[toolName]
  // Support both ToolRegistration ({ create }) and raw tool() objects
  const executable = typeof toolDef.create === 'function' ? toolDef.create() : toolDef
  return executable.execute(input)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Calendar plugin', () => {
  let ctx: ReturnType<typeof makeCtx>
  let plugin: ReturnType<typeof createPlugin>

  beforeEach(() => {
    ctx = makeCtx()
    plugin = createPlugin(ctx)
  })

  test('exports expected tools', () => {
    const names = Object.keys(plugin.tools)
    expect(names).toContain('create_event')
    expect(names).toContain('list_events')
    expect(names).toContain('get_event')
    expect(names).toContain('update_event')
    expect(names).toContain('delete_event')
    expect(names).toContain('upcoming_events')
    expect(names).toContain('search_events')
  })

  describe('create_event', () => {
    test('creates a basic event', async () => {
      const res = await executeTool(plugin, 'create_event', {
        title: 'Team meeting',
        start: '2025-06-15T10:00:00Z',
      })
      expect(res.created).toBeDefined()
      expect(res.created.title).toBe('Team meeting')
      expect(res.created.id).toMatch(/^evt-/)
      expect(res.total).toBe(1)
    })

    test('creates event with all optional fields', async () => {
      const res = await executeTool(plugin, 'create_event', {
        title: 'Conference',
        start: '2025-06-20T09:00:00Z',
        end: '2025-06-20T17:00:00Z',
        description: 'Annual dev conference',
        location: 'Paris',
        tags: ['work', 'travel'],
        reminderMinutes: 30,
        recurrence: 'yearly',
        allDay: false,
      })
      expect(res.created.title).toBe('Conference')
      expect(res.created.location).toBe('Paris')
      expect(res.created.tags).toEqual(['work', 'travel'])
      expect(res.created.recurrence).toBe('yearly')
      expect(res.created.reminder).toBe('30min before')
    })

    test('rejects end before start', async () => {
      const res = await executeTool(plugin, 'create_event', {
        title: 'Bad event',
        start: '2025-06-15T10:00:00Z',
        end: '2025-06-15T09:00:00Z',
      })
      expect(res.error).toBeDefined()
      expect(res.error).toContain('End time must be after start time')
    })

    test('applies default reminder', async () => {
      const res = await executeTool(plugin, 'create_event', {
        title: 'With default reminder',
        start: '2025-06-15T10:00:00Z',
      })
      expect(res.created.reminder).toBe('15min before')
    })

    test('enforces max events limit', async () => {
      const smallCtx = makeCtx({ maxEvents: '3' })
      const smallPlugin = createPlugin(smallCtx)
      for (let i = 0; i < 5; i++) {
        await executeTool(smallPlugin, 'create_event', {
          title: `Event ${i}`,
          start: `2025-06-${15 + i}T10:00:00Z`,
        })
      }
      const res = await executeTool(smallPlugin, 'list_events', {
        from: '2025-06-01T00:00:00Z',
        to: '2025-06-30T23:59:59Z',
      })
      expect(res.total).toBeLessThanOrEqual(3)
    })
  })

  describe('get_event', () => {
    test('retrieves existing event', async () => {
      const created = await executeTool(plugin, 'create_event', {
        title: 'Lunch',
        start: '2025-06-15T12:00:00Z',
      })
      const res = await executeTool(plugin, 'get_event', { id: created.created.id })
      expect(res.event.title).toBe('Lunch')
    })

    test('returns error for missing event', async () => {
      const res = await executeTool(plugin, 'get_event', { id: 'evt-999' })
      expect(res.error).toContain('not found')
    })
  })

  describe('update_event', () => {
    test('updates event fields', async () => {
      const created = await executeTool(plugin, 'create_event', {
        title: 'Old title',
        start: '2025-06-15T10:00:00Z',
      })
      const res = await executeTool(plugin, 'update_event', {
        id: created.created.id,
        title: 'New title',
        location: 'Room 42',
      })
      expect(res.updated.title).toBe('New title')
      expect(res.updated.location).toBe('Room 42')
    })

    test('returns error for missing event', async () => {
      const res = await executeTool(plugin, 'update_event', {
        id: 'evt-999',
        title: 'Nope',
      })
      expect(res.error).toContain('not found')
    })
  })

  describe('delete_event', () => {
    test('deletes existing event', async () => {
      const created = await executeTool(plugin, 'create_event', {
        title: 'Deletable',
        start: '2025-06-15T10:00:00Z',
      })
      const res = await executeTool(plugin, 'delete_event', { id: created.created.id })
      expect(res.deleted.title).toBe('Deletable')
      expect(res.remaining).toBe(0)
    })

    test('returns error for missing event', async () => {
      const res = await executeTool(plugin, 'delete_event', { id: 'evt-999' })
      expect(res.error).toContain('not found')
    })
  })

  describe('list_events', () => {
    test('lists events in range', async () => {
      await executeTool(plugin, 'create_event', {
        title: 'In range',
        start: '2025-06-15T10:00:00Z',
      })
      await executeTool(plugin, 'create_event', {
        title: 'Out of range',
        start: '2025-07-15T10:00:00Z',
      })
      const res = await executeTool(plugin, 'list_events', {
        from: '2025-06-01T00:00:00Z',
        to: '2025-06-30T23:59:59Z',
      })
      expect(res.events.length).toBe(1)
      expect(res.events[0].title).toBe('In range')
    })

    test('filters by tag', async () => {
      await executeTool(plugin, 'create_event', {
        title: 'Tagged',
        start: '2025-06-15T10:00:00Z',
        tags: ['work'],
      })
      await executeTool(plugin, 'create_event', {
        title: 'Untagged',
        start: '2025-06-16T10:00:00Z',
      })
      const res = await executeTool(plugin, 'list_events', {
        from: '2025-06-01T00:00:00Z',
        to: '2025-06-30T23:59:59Z',
        tag: 'work',
      })
      expect(res.events.length).toBe(1)
      expect(res.events[0].title).toBe('Tagged')
    })

    test('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await executeTool(plugin, 'create_event', {
          title: `Event ${i}`,
          start: `2025-06-${15 + i}T10:00:00Z`,
        })
      }
      const res = await executeTool(plugin, 'list_events', {
        from: '2025-06-01T00:00:00Z',
        to: '2025-06-30T23:59:59Z',
        limit: 2,
      })
      expect(res.events.length).toBe(2)
      expect(res.total).toBe(5)
    })
  })

  describe('upcoming_events', () => {
    test('returns events within window', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString()
      await executeTool(plugin, 'create_event', {
        title: 'Soon',
        start: futureDate,
      })
      const res = await executeTool(plugin, 'upcoming_events', { hours: 2 })
      expect(res.events.length).toBe(1)
      expect(res.events[0].title).toBe('Soon')
    })

    test('excludes events outside window', async () => {
      const farDate = new Date(Date.now() + 86400000 * 30).toISOString()
      await executeTool(plugin, 'create_event', {
        title: 'Far away',
        start: farDate,
      })
      const res = await executeTool(plugin, 'upcoming_events', { hours: 1 })
      expect(res.events.length).toBe(0)
    })
  })

  describe('search_events', () => {
    test('searches by title', async () => {
      await executeTool(plugin, 'create_event', {
        title: 'Dentist appointment',
        start: '2025-06-15T10:00:00Z',
      })
      await executeTool(plugin, 'create_event', {
        title: 'Team standup',
        start: '2025-06-16T10:00:00Z',
      })
      const res = await executeTool(plugin, 'search_events', { query: 'dentist' })
      expect(res.results.length).toBe(1)
      expect(res.results[0].title).toBe('Dentist appointment')
    })

    test('searches by location', async () => {
      await executeTool(plugin, 'create_event', {
        title: 'Meeting',
        start: '2025-06-15T10:00:00Z',
        location: 'Conference Room B',
      })
      const res = await executeTool(plugin, 'search_events', { query: 'conference' })
      expect(res.results.length).toBe(1)
    })

    test('searches by tag', async () => {
      await executeTool(plugin, 'create_event', {
        title: 'Sprint review',
        start: '2025-06-15T10:00:00Z',
        tags: ['agile'],
      })
      const res = await executeTool(plugin, 'search_events', { query: 'agile' })
      expect(res.results.length).toBe(1)
    })

    test('respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await executeTool(plugin, 'create_event', {
          title: `Recurring meeting ${i}`,
          start: `2025-06-${15 + i}T10:00:00Z`,
        })
      }
      const res = await executeTool(plugin, 'search_events', {
        query: 'recurring',
        limit: 2,
      })
      expect(res.results.length).toBe(2)
    })
  })
})
