import { describe, test, expect, beforeEach } from 'bun:test'
import createPlugin from './index'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePlugin(maxNotes = '250') {
  return createPlugin({ kinId: `test-${Date.now()}-${Math.random()}`, config: { maxNotes } })
}

async function executeTool(plugin: ReturnType<typeof makePlugin>, name: string, input: any) {
  const reg = (plugin.tools as any)[name]
  const t = reg.create({} as any)
  return t.execute(input, {} as any)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('notes plugin', () => {
  let plugin: ReturnType<typeof makePlugin>

  beforeEach(() => {
    plugin = makePlugin()
  })

  // ── note_create ─────────────────────────────────────────────────────────

  describe('note_create', () => {
    test('creates a note with title and content', async () => {
      const res = await executeTool(plugin, 'note_create', {
        title: 'Test Note',
        content: 'Hello world',
      })
      expect(res.saved).toBeDefined()
      expect(res.saved.title).toBe('Test Note')
      expect(res.saved.content).toBe('Hello world')
      expect(res.saved.tags).toEqual([])
      expect(res.saved.pinned).toBe(false)
      expect(res.total).toBe(1)
    })

    test('creates a note with tags and pinned', async () => {
      const res = await executeTool(plugin, 'note_create', {
        title: 'Tagged',
        content: 'body',
        tags: ['work', 'urgent'],
        pinned: true,
      })
      expect(res.saved.tags).toEqual(['work', 'urgent'])
      expect(res.saved.pinned).toBe(true)
    })

    test('assigns unique IDs to multiple notes', async () => {
      const a = await executeTool(plugin, 'note_create', { title: 'A', content: 'a' })
      const b = await executeTool(plugin, 'note_create', { title: 'B', content: 'b' })
      expect(a.saved.id).not.toBe(b.saved.id)
      expect(b.total).toBe(2)
    })

    test('includes ISO timestamps', async () => {
      const res = await executeTool(plugin, 'note_create', { title: 'T', content: 'c' })
      expect(res.saved.created).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(res.saved.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('enforces maxNotes limit', async () => {
      const small = makePlugin('2')
      await executeTool(small, 'note_create', { title: 'A', content: 'a' })
      await executeTool(small, 'note_create', { title: 'B', content: 'b' })
      const res = await executeTool(small, 'note_create', { title: 'C', content: 'c' })
      expect(res.error).toContain('limit reached')
    })

    test('defaults tags to empty array when omitted', async () => {
      const res = await executeTool(plugin, 'note_create', { title: 'X', content: 'y' })
      expect(res.saved.tags).toEqual([])
    })

    test('defaults pinned to false when omitted', async () => {
      const res = await executeTool(plugin, 'note_create', { title: 'X', content: 'y' })
      expect(res.saved.pinned).toBe(false)
    })
  })

  // ── note_view ───────────────────────────────────────────────────────────

  describe('note_view', () => {
    test('returns full note by ID', async () => {
      const created = await executeTool(plugin, 'note_create', {
        title: 'My Note',
        content: 'Full content here',
        tags: ['test'],
      })
      const res = await executeTool(plugin, 'note_view', { id: created.saved.id })
      expect(res.note.title).toBe('My Note')
      expect(res.note.content).toBe('Full content here')
      expect(res.note.tags).toEqual(['test'])
    })

    test('returns error for non-existent ID', async () => {
      const res = await executeTool(plugin, 'note_view', { id: 'note-999' })
      expect(res.error).toContain('not found')
    })
  })

  // ── note_update ─────────────────────────────────────────────────────────

  describe('note_update', () => {
    test('updates title only', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'Old', content: 'body' })
      const res = await executeTool(plugin, 'note_update', { id: created.saved.id, title: 'New' })
      expect(res.updated.title).toBe('New')
      expect(res.updated.content).toBe('body')
    })

    test('updates content only', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'old' })
      const res = await executeTool(plugin, 'note_update', { id: created.saved.id, content: 'new' })
      expect(res.updated.content).toBe('new')
      expect(res.updated.title).toBe('T')
    })

    test('updates tags', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c', tags: ['a'] })
      const res = await executeTool(plugin, 'note_update', { id: created.saved.id, tags: ['b', 'c'] })
      expect(res.updated.tags).toEqual(['b', 'c'])
    })

    test('updates pinned status', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c' })
      const res = await executeTool(plugin, 'note_update', { id: created.saved.id, pinned: true })
      expect(res.updated.pinned).toBe(true)
    })

    test('updates updatedAt timestamp', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c' })
      // Small delay to ensure timestamp differs
      await new Promise(r => setTimeout(r, 5))
      const res = await executeTool(plugin, 'note_update', { id: created.saved.id, title: 'T2' })
      expect(new Date(res.updated.updated).getTime()).toBeGreaterThanOrEqual(
        new Date(created.saved.updated).getTime()
      )
    })

    test('returns error for non-existent ID', async () => {
      const res = await executeTool(plugin, 'note_update', { id: 'note-999', title: 'X' })
      expect(res.error).toContain('not found')
    })
  })

  // ── note_delete ─────────────────────────────────────────────────────────

  describe('note_delete', () => {
    test('deletes an existing note', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'Doomed', content: 'bye' })
      const res = await executeTool(plugin, 'note_delete', { id: created.saved.id })
      expect(res.deleted).toBe(created.saved.id)
      expect(res.title).toBe('Doomed')
      expect(res.remaining).toBe(0)
    })

    test('note is gone after deletion', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c' })
      await executeTool(plugin, 'note_delete', { id: created.saved.id })
      const view = await executeTool(plugin, 'note_view', { id: created.saved.id })
      expect(view.error).toContain('not found')
    })

    test('returns error for non-existent ID', async () => {
      const res = await executeTool(plugin, 'note_delete', { id: 'note-999' })
      expect(res.error).toContain('not found')
    })

    test('frees up a slot after deletion when at limit', async () => {
      const small = makePlugin('1')
      const created = await executeTool(small, 'note_create', { title: 'A', content: 'a' })
      await executeTool(small, 'note_delete', { id: created.saved.id })
      const res = await executeTool(small, 'note_create', { title: 'B', content: 'b' })
      expect(res.saved).toBeDefined()
      expect(res.saved.title).toBe('B')
    })
  })

  // ── note_pin ────────────────────────────────────────────────────────────

  describe('note_pin', () => {
    test('toggles pin on', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c' })
      const res = await executeTool(plugin, 'note_pin', { id: created.saved.id })
      expect(res.pinned).toBe(true)
    })

    test('toggles pin off', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c', pinned: true })
      const res = await executeTool(plugin, 'note_pin', { id: created.saved.id })
      expect(res.pinned).toBe(false)
    })

    test('double toggle returns to original state', async () => {
      const created = await executeTool(plugin, 'note_create', { title: 'T', content: 'c' })
      await executeTool(plugin, 'note_pin', { id: created.saved.id })
      const res = await executeTool(plugin, 'note_pin', { id: created.saved.id })
      expect(res.pinned).toBe(false)
    })

    test('returns error for non-existent ID', async () => {
      const res = await executeTool(plugin, 'note_pin', { id: 'note-999' })
      expect(res.error).toContain('not found')
    })
  })

  // ── note_search ─────────────────────────────────────────────────────────

  describe('note_search', () => {
    test('lists all notes when no query', async () => {
      await executeTool(plugin, 'note_create', { title: 'A', content: 'a' })
      await executeTool(plugin, 'note_create', { title: 'B', content: 'b' })
      const res = await executeTool(plugin, 'note_search', {})
      expect(res.total).toBe(2)
      expect(res.results).toHaveLength(2)
    })

    test('filters by query in title', async () => {
      await executeTool(plugin, 'note_create', { title: 'Shopping list', content: 'milk' })
      await executeTool(plugin, 'note_create', { title: 'Work notes', content: 'meeting' })
      const res = await executeTool(plugin, 'note_search', { query: 'shopping' })
      expect(res.total).toBe(1)
      expect(res.results[0].title).toBe('Shopping list')
    })

    test('filters by query in content', async () => {
      await executeTool(plugin, 'note_create', { title: 'A', content: 'buy milk and eggs' })
      await executeTool(plugin, 'note_create', { title: 'B', content: 'nothing here' })
      const res = await executeTool(plugin, 'note_search', { query: 'milk' })
      expect(res.total).toBe(1)
      expect(res.results[0].content).toBe('buy milk and eggs')
    })

    test('filters by query in tags', async () => {
      await executeTool(plugin, 'note_create', { title: 'A', content: 'a', tags: ['urgent'] })
      await executeTool(plugin, 'note_create', { title: 'B', content: 'b', tags: ['casual'] })
      const res = await executeTool(plugin, 'note_search', { query: 'urgent' })
      expect(res.total).toBe(1)
    })

    test('query is case-insensitive', async () => {
      await executeTool(plugin, 'note_create', { title: 'HELLO World', content: 'x' })
      const res = await executeTool(plugin, 'note_search', { query: 'hello' })
      expect(res.total).toBe(1)
    })

    test('filters by tag', async () => {
      await executeTool(plugin, 'note_create', { title: 'A', content: 'a', tags: ['work'] })
      await executeTool(plugin, 'note_create', { title: 'B', content: 'b', tags: ['personal'] })
      await executeTool(plugin, 'note_create', { title: 'C', content: 'c', tags: ['Work'] })
      const res = await executeTool(plugin, 'note_search', { tag: 'work' })
      expect(res.total).toBe(2)
    })

    test('filters by pinnedOnly', async () => {
      await executeTool(plugin, 'note_create', { title: 'Pinned', content: 'a', pinned: true })
      await executeTool(plugin, 'note_create', { title: 'Not pinned', content: 'b' })
      const res = await executeTool(plugin, 'note_search', { pinnedOnly: true })
      expect(res.total).toBe(1)
      expect(res.results[0].title).toBe('Pinned')
    })

    test('pinned notes appear first in results', async () => {
      await executeTool(plugin, 'note_create', { title: 'Normal', content: 'a' })
      await executeTool(plugin, 'note_create', { title: 'Pinned', content: 'b', pinned: true })
      const res = await executeTool(plugin, 'note_search', {})
      expect(res.results[0].title).toBe('Pinned')
      expect(res.results[1].title).toBe('Normal')
    })

    test('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await executeTool(plugin, 'note_create', { title: `Note ${i}`, content: 'x' })
      }
      const res = await executeTool(plugin, 'note_search', { limit: 3 })
      expect(res.showing).toBe(3)
      expect(res.total).toBe(5)
    })

    test('defaults limit to 20', async () => {
      for (let i = 0; i < 25; i++) {
        await executeTool(plugin, 'note_create', { title: `Note ${i}`, content: 'x' })
      }
      const res = await executeTool(plugin, 'note_search', {})
      expect(res.showing).toBe(20)
      expect(res.total).toBe(25)
    })

    test('sorts by most recently updated (after pin grouping)', async () => {
      const a = await executeTool(plugin, 'note_create', { title: 'Old', content: 'a' })
      await new Promise(r => setTimeout(r, 5))
      await executeTool(plugin, 'note_create', { title: 'New', content: 'b' })
      const res = await executeTool(plugin, 'note_search', {})
      expect(res.results[0].title).toBe('New')
      expect(res.results[1].title).toBe('Old')
    })

    test('combines query and tag filters', async () => {
      await executeTool(plugin, 'note_create', { title: 'Work meeting', content: 'discuss', tags: ['work'] })
      await executeTool(plugin, 'note_create', { title: 'Work lunch', content: 'eat', tags: ['personal'] })
      await executeTool(plugin, 'note_create', { title: 'Home stuff', content: 'clean', tags: ['chores'] })
      const res = await executeTool(plugin, 'note_search', { query: 'meeting', tag: 'work' })
      expect(res.total).toBe(1)
      expect(res.results[0].title).toBe('Work meeting')
    })

    test('returns empty results for no matches', async () => {
      await executeTool(plugin, 'note_create', { title: 'A', content: 'a' })
      const res = await executeTool(plugin, 'note_search', { query: 'nonexistent' })
      expect(res.total).toBe(0)
      expect(res.results).toEqual([])
    })
  })

  // ── availability ────────────────────────────────────────────────────────

  describe('availability', () => {
    test('all tools are available to main and sub-kin', () => {
      const toolNames = Object.keys(plugin.tools)
      expect(toolNames).toContain('note_create')
      expect(toolNames).toContain('note_update')
      expect(toolNames).toContain('note_delete')
      expect(toolNames).toContain('note_search')
      expect(toolNames).toContain('note_view')
      expect(toolNames).toContain('note_pin')

      for (const name of toolNames) {
        const reg = (plugin.tools as any)[name]
        expect(reg.availability).toEqual(['main', 'sub-kin'])
      }
    })
  })

  // ── isolation ───────────────────────────────────────────────────────────

  describe('state isolation', () => {
    test('different kinIds have separate state', async () => {
      const p1 = createPlugin({ kinId: `iso-a-${Date.now()}`, config: { maxNotes: '250' } })
      const p2 = createPlugin({ kinId: `iso-b-${Date.now()}`, config: { maxNotes: '250' } })

      await executeTool(p1, 'note_create', { title: 'From P1', content: 'x' })
      const res = await executeTool(p2, 'note_search', {})
      expect(res.total).toBe(0)
    })
  })
})
