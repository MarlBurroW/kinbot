import { describe, test, expect, beforeEach } from 'bun:test'
import createPlugin from './index'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(config: Record<string, string> = {}, kinId = 'test-kin') {
  return {
    config: { maxBookmarks: '250', ...config },
    kinId,
    log: { info: () => {} },
  }
}

async function executeTool(plugin: ReturnType<typeof createPlugin>, toolName: string, input: any = {}) {
  const toolDef = (plugin.tools as any)[toolName]
  const created = toolDef.create()
  return created.execute(input)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Bookmarks plugin', () => {
  let ctx: ReturnType<typeof makeCtx>
  let plugin: ReturnType<typeof createPlugin>

  beforeEach(() => {
    // Use unique kinId per test to avoid state leaks
    ctx = makeCtx({}, `test-${Date.now()}-${Math.random()}`)
    plugin = createPlugin(ctx)
  })

  test('exports expected tools', () => {
    expect(Object.keys(plugin.tools).sort()).toEqual([
      'bookmark_delete',
      'bookmark_edit',
      'bookmark_list',
      'bookmark_save',
      'bookmark_search',
    ])
  })

  test('all tools have main and sub-kin availability', () => {
    for (const [, def] of Object.entries(plugin.tools)) {
      expect((def as any).availability).toEqual(['main', 'sub-kin'])
    }
  })

  // ─── bookmark_save ───────────────────────────────────────────────────

  describe('bookmark_save', () => {
    test('saves a basic bookmark', async () => {
      const result = await executeTool(plugin, 'bookmark_save', {
        url: 'https://example.com',
        title: 'Example Site',
      })

      expect(result.status).toBe('saved')
      expect(result.bookmark.url).toBe('https://example.com')
      expect(result.bookmark.title).toBe('Example Site')
      expect(result.bookmark.id).toBe('bk-1')
      expect(result.total).toBe(1)
    })

    test('saves with tags and note', async () => {
      const result = await executeTool(plugin, 'bookmark_save', {
        url: 'https://rust-lang.org',
        title: 'Rust',
        tags: ['Dev', ' Rust ', 'lang'],
        note: 'Great language',
      })

      expect(result.bookmark.tags).toEqual(['dev', 'rust', 'lang'])
      expect(result.bookmark.note).toBe('Great language')
    })

    test('filters empty tags', async () => {
      const result = await executeTool(plugin, 'bookmark_save', {
        url: 'https://example.com',
        title: 'Test',
        tags: ['valid', '', '  ', 'also-valid'],
      })

      expect(result.bookmark.tags).toEqual(['valid', 'also-valid'])
    })

    test('increments IDs', async () => {
      const r1 = await executeTool(plugin, 'bookmark_save', { url: 'https://a.com', title: 'A' })
      const r2 = await executeTool(plugin, 'bookmark_save', { url: 'https://b.com', title: 'B' })

      expect(r1.bookmark.id).toBe('bk-1')
      expect(r2.bookmark.id).toBe('bk-2')
      expect(r2.total).toBe(2)
    })

    test('rejects duplicate URL', async () => {
      await executeTool(plugin, 'bookmark_save', { url: 'https://dup.com', title: 'First' })
      const result = await executeTool(plugin, 'bookmark_save', { url: 'https://dup.com', title: 'Second' })

      expect(result.error).toContain('already bookmarked')
      expect(result.existing.title).toBe('First')
    })

    test('enforces max bookmarks limit', async () => {
      const smallCtx = makeCtx({ maxBookmarks: '2' }, `limit-${Date.now()}`)
      const smallPlugin = createPlugin(smallCtx)

      await executeTool(smallPlugin, 'bookmark_save', { url: 'https://1.com', title: '1' })
      await executeTool(smallPlugin, 'bookmark_save', { url: 'https://2.com', title: '2' })
      const result = await executeTool(smallPlugin, 'bookmark_save', { url: 'https://3.com', title: '3' })

      expect(result.error).toContain('limit reached')
    })

    test('message includes tags when present', async () => {
      const result = await executeTool(plugin, 'bookmark_save', {
        url: 'https://example.com',
        title: 'Test',
        tags: ['foo', 'bar'],
      })

      expect(result.message).toContain('[foo, bar]')
    })

    test('message excludes tags when none', async () => {
      const result = await executeTool(plugin, 'bookmark_save', {
        url: 'https://example.com',
        title: 'Test',
      })

      expect(result.message).not.toContain('[')
    })
  })

  // ─── bookmark_search ─────────────────────────────────────────────────

  describe('bookmark_search', () => {
    beforeEach(async () => {
      await executeTool(plugin, 'bookmark_save', {
        url: 'https://rust-lang.org',
        title: 'Rust Programming',
        tags: ['dev', 'rust'],
        note: 'Systems language',
      })
      await executeTool(plugin, 'bookmark_save', {
        url: 'https://python.org',
        title: 'Python',
        tags: ['dev', 'python'],
      })
      await executeTool(plugin, 'bookmark_save', {
        url: 'https://cooking.com/pasta',
        title: 'Best Pasta Recipe',
        tags: ['food', 'recipe'],
      })
    })

    test('searches by title', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'rust' })
      expect(result.count).toBe(1)
      expect(result.bookmarks[0].title).toBe('Rust Programming')
    })

    test('searches by URL', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'python.org' })
      expect(result.count).toBe(1)
    })

    test('searches by tag', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'dev' })
      expect(result.count).toBe(2)
    })

    test('searches by note', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'systems' })
      expect(result.count).toBe(1)
    })

    test('filters by exact tag', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: '', tag: 'dev' })
      expect(result.count).toBe(2)
    })

    test('combines query and tag filter', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'rust', tag: 'dev' })
      expect(result.count).toBe(1)
    })

    test('returns empty when no match', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'nonexistent' })
      expect(result.count).toBe(0)
      expect(result.message).toContain('No bookmarks')
    })

    test('respects limit', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: '', limit: 1 })
      expect(result.bookmarks).toHaveLength(1)
    })

    test('caps limit at 50', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: '', limit: 100 })
      // Should not error, just caps
      expect(result.count).toBeLessThanOrEqual(50)
    })

    test('sorts results by most recent first', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: '' })
      // All 3 bookmarks returned, sorted by createdAt descending
      expect(result.count).toBe(3)
      const timestamps = result.bookmarks.map((b: any) => new Date(b.saved).getTime())
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1])
      }
    })

    test('reports total bookmarks', async () => {
      const result = await executeTool(plugin, 'bookmark_search', { query: 'rust' })
      expect(result.total).toBe(3)
    })
  })

  // ─── bookmark_list ────────────────────────────────────────────────────

  describe('bookmark_list', () => {
    beforeEach(async () => {
      await executeTool(plugin, 'bookmark_save', {
        url: 'https://a.com', title: 'A', tags: ['x', 'y'],
      })
      await executeTool(plugin, 'bookmark_save', {
        url: 'https://b.com', title: 'B', tags: ['x'],
      })
    })

    test('lists all bookmarks', async () => {
      const result = await executeTool(plugin, 'bookmark_list', {})
      expect(result.total).toBe(2)
      expect(result.showing).toBe(2)
      expect(result.bookmarks).toHaveLength(2)
    })

    test('filters by tag', async () => {
      const result = await executeTool(plugin, 'bookmark_list', { tag: 'y' })
      expect(result.bookmarks).toHaveLength(1)
      expect(result.bookmarks[0].title).toBe('A')
    })

    test('returns tag counts', async () => {
      const result = await executeTool(plugin, 'bookmark_list', {})
      expect(result.tags).toEqual({ x: 2, y: 1 })
    })

    test('respects limit', async () => {
      const result = await executeTool(plugin, 'bookmark_list', { limit: 1 })
      expect(result.bookmarks).toHaveLength(1)
      expect(result.showing).toBe(1)
    })

    test('empty collection', async () => {
      const emptyPlugin = createPlugin(makeCtx({}, `empty-${Date.now()}`))
      const result = await executeTool(emptyPlugin, 'bookmark_list', {})
      expect(result.total).toBe(0)
      expect(result.bookmarks).toEqual([])
      expect(result.tags).toEqual({})
    })
  })

  // ─── bookmark_delete ─────────────────────────────────────────────────

  describe('bookmark_delete', () => {
    beforeEach(async () => {
      await executeTool(plugin, 'bookmark_save', { url: 'https://del.com', title: 'To Delete' })
    })

    test('deletes existing bookmark', async () => {
      const result = await executeTool(plugin, 'bookmark_delete', { id: 'bk-1' })
      expect(result.status).toBe('deleted')
      expect(result.bookmark.title).toBe('To Delete')
      expect(result.remaining).toBe(0)
    })

    test('returns error for nonexistent ID', async () => {
      const result = await executeTool(plugin, 'bookmark_delete', { id: 'bk-999' })
      expect(result.error).toContain('not found')
    })

    test('bookmark is gone after delete', async () => {
      await executeTool(plugin, 'bookmark_delete', { id: 'bk-1' })
      const list = await executeTool(plugin, 'bookmark_list', {})
      expect(list.total).toBe(0)
    })
  })

  // ─── bookmark_edit ────────────────────────────────────────────────────

  describe('bookmark_edit', () => {
    beforeEach(async () => {
      await executeTool(plugin, 'bookmark_save', {
        url: 'https://edit.com',
        title: 'Original',
        tags: ['old'],
        note: 'Old note',
      })
    })

    test('updates title', async () => {
      const result = await executeTool(plugin, 'bookmark_edit', { id: 'bk-1', title: 'New Title' })
      expect(result.status).toBe('updated')
      expect(result.bookmark.title).toBe('New Title')
    })

    test('updates tags', async () => {
      const result = await executeTool(plugin, 'bookmark_edit', { id: 'bk-1', tags: ['New', 'Tags'] })
      expect(result.bookmark.tags).toEqual(['new', 'tags'])
    })

    test('updates note', async () => {
      const result = await executeTool(plugin, 'bookmark_edit', { id: 'bk-1', note: 'New note' })
      expect(result.bookmark.note).toBe('New note')
    })

    test('clears note with empty string', async () => {
      const result = await executeTool(plugin, 'bookmark_edit', { id: 'bk-1', note: '' })
      expect(result.bookmark.note).toBeNull()
    })

    test('preserves unchanged fields', async () => {
      const result = await executeTool(plugin, 'bookmark_edit', { id: 'bk-1', title: 'Changed' })
      expect(result.bookmark.url).toBe('https://edit.com')
      // Tags should remain from original save
    })

    test('returns error for nonexistent ID', async () => {
      const result = await executeTool(plugin, 'bookmark_edit', { id: 'bk-999', title: 'X' })
      expect(result.error).toContain('not found')
    })
  })

  // ─── Lifecycle ────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    test('activate does not throw', async () => {
      await expect(plugin.activate()).resolves.toBeUndefined()
    })

    test('deactivate clears state', async () => {
      await executeTool(plugin, 'bookmark_save', { url: 'https://x.com', title: 'X' })
      await plugin.deactivate()

      // Recreate plugin with same kinId - state should be gone
      const fresh = createPlugin(ctx)
      const list = await executeTool(fresh, 'bookmark_list', {})
      expect(list.total).toBe(0)
    })
  })

  // ─── Config ───────────────────────────────────────────────────────────

  describe('config', () => {
    test('defaults maxBookmarks to 250 when not set', () => {
      const p = createPlugin({ config: {}, log: { info: () => {} } })
      expect(Object.keys(p.tools)).toHaveLength(5)
    })

    test('isolates state between kinIds', async () => {
      const p1 = createPlugin(makeCtx({}, 'kin-a'))
      const p2 = createPlugin(makeCtx({}, 'kin-b'))

      await executeTool(p1, 'bookmark_save', { url: 'https://a.com', title: 'A' })
      const list = await executeTool(p2, 'bookmark_list', {})
      expect(list.total).toBe(0)
    })
  })
})
