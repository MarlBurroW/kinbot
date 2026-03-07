import { tool } from 'ai'
import { z } from 'zod'

/**
 * Bookmarks plugin for KinBot.
 * Save, tag, search, and manage bookmarks. State is kept in-memory per Kin.
 */

interface Bookmark {
  id: string
  url: string
  title: string
  tags: string[]
  note?: string
  createdAt: number
}

interface BookmarkState {
  bookmarks: Map<string, Bookmark>
  nextId: number
}

const states = new Map<string, BookmarkState>()

function getState(id: string): BookmarkState {
  if (!states.has(id)) {
    states.set(id, { bookmarks: new Map(), nextId: 1 })
  }
  return states.get(id)!
}

function generateId(state: BookmarkState): string {
  return `bk-${state.nextId++}`
}

function matchesQuery(bookmark: Bookmark, query: string): boolean {
  const q = query.toLowerCase()
  return (
    bookmark.title.toLowerCase().includes(q) ||
    bookmark.url.toLowerCase().includes(q) ||
    bookmark.tags.some((t) => t.toLowerCase().includes(q)) ||
    (bookmark.note?.toLowerCase().includes(q) ?? false)
  )
}

function formatBookmark(b: Bookmark): object {
  return {
    id: b.id,
    title: b.title,
    url: b.url,
    tags: b.tags,
    note: b.note || null,
    saved: new Date(b.createdAt).toISOString(),
  }
}

export default function (ctx: any) {
  const maxBookmarks = parseInt(ctx.config.maxBookmarks || '250', 10)
  const stateId = ctx.manifest?.name || ctx.kinId || 'default'

  return {
    tools: {
      bookmark_save: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Save a bookmark. Provide a URL, title, optional tags, and optional note. ' +
              'Use this when the user shares a link they want to remember.',
            inputSchema: z.object({
              url: z.string().describe('The URL to bookmark'),
              title: z.string().describe('A short descriptive title'),
              tags: z
                .array(z.string())
                .optional()
                .describe('Tags for categorization (e.g. ["dev", "rust", "tutorial"])'),
              note: z.string().optional().describe('Optional note about why this link is useful'),
            }),
            execute: async ({
              url,
              title,
              tags,
              note,
            }: {
              url: string
              title: string
              tags?: string[]
              note?: string
            }) => {
              const state = getState(stateId)

              if (state.bookmarks.size >= maxBookmarks) {
                return {
                  error: `Bookmark limit reached (${maxBookmarks}). Delete some bookmarks first.`,
                }
              }

              // Check for duplicate URL
              for (const b of state.bookmarks.values()) {
                if (b.url === url) {
                  return {
                    error: `This URL is already bookmarked as "${b.title}" (${b.id}).`,
                    existing: formatBookmark(b),
                  }
                }
              }

              const id = generateId(state)
              const bookmark: Bookmark = {
                id,
                url,
                title,
                tags: (tags || []).map((t) => t.toLowerCase().trim()).filter(Boolean),
                note,
                createdAt: Date.now(),
              }
              state.bookmarks.set(id, bookmark)

              return {
                status: 'saved',
                bookmark: formatBookmark(bookmark),
                total: state.bookmarks.size,
                message: `🔖 Saved: "${title}"` + (bookmark.tags.length ? ` [${bookmark.tags.join(', ')}]` : ''),
              }
            },
          }),
      },

      bookmark_search: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Search bookmarks by keyword. Matches against title, URL, tags, and notes. ' +
              'Returns matching bookmarks sorted by most recent.',
            inputSchema: z.object({
              query: z.string().describe('Search term to match against titles, URLs, tags, notes'),
              tag: z.string().optional().describe('Filter by exact tag'),
              limit: z.number().optional().describe('Max results to return (default 10)'),
            }),
            execute: async ({
              query,
              tag,
              limit,
            }: {
              query: string
              tag?: string
              limit?: number
            }) => {
              const state = getState(stateId)
              const max = Math.min(limit || 10, 50)

              let results = Array.from(state.bookmarks.values())

              if (query.trim()) {
                results = results.filter((b) => matchesQuery(b, query))
              }

              if (tag) {
                const normalizedTag = tag.toLowerCase().trim()
                results = results.filter((b) => b.tags.includes(normalizedTag))
              }

              results.sort((a, b) => b.createdAt - a.createdAt)
              results = results.slice(0, max)

              return {
                count: results.length,
                total: state.bookmarks.size,
                bookmarks: results.map(formatBookmark),
                message:
                  results.length > 0
                    ? `Found ${results.length} bookmark${results.length !== 1 ? 's' : ''}.`
                    : 'No bookmarks match your search.',
              }
            },
          }),
      },

      bookmark_list: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'List all bookmarks or filter by tag. Shows bookmarks sorted by most recent first.',
            inputSchema: z.object({
              tag: z.string().optional().describe('Filter by tag'),
              limit: z.number().optional().describe('Max results (default 20)'),
            }),
            execute: async ({ tag, limit }: { tag?: string; limit?: number }) => {
              const state = getState(stateId)
              const max = Math.min(limit || 20, 50)

              let results = Array.from(state.bookmarks.values())

              if (tag) {
                const normalizedTag = tag.toLowerCase().trim()
                results = results.filter((b) => b.tags.includes(normalizedTag))
              }

              results.sort((a, b) => b.createdAt - a.createdAt)

              // Collect all tags for overview
              const allTags = new Map<string, number>()
              for (const b of state.bookmarks.values()) {
                for (const t of b.tags) {
                  allTags.set(t, (allTags.get(t) || 0) + 1)
                }
              }

              return {
                total: state.bookmarks.size,
                showing: Math.min(results.length, max),
                tags: Object.fromEntries(allTags),
                bookmarks: results.slice(0, max).map(formatBookmark),
              }
            },
          }),
      },

      bookmark_delete: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Delete a bookmark by its ID.',
            inputSchema: z.object({
              id: z.string().describe('Bookmark ID to delete (e.g. "bk-3")'),
            }),
            execute: async ({ id }: { id: string }) => {
              const state = getState(stateId)
              const bookmark = state.bookmarks.get(id)

              if (!bookmark) {
                return { error: `Bookmark "${id}" not found.` }
              }

              state.bookmarks.delete(id)

              return {
                status: 'deleted',
                bookmark: formatBookmark(bookmark),
                remaining: state.bookmarks.size,
                message: `🗑️ Deleted: "${bookmark.title}"`,
              }
            },
          }),
      },

      bookmark_edit: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Edit an existing bookmark. Update its title, tags, or note.',
            inputSchema: z.object({
              id: z.string().describe('Bookmark ID to edit'),
              title: z.string().optional().describe('New title'),
              tags: z.array(z.string()).optional().describe('Replace tags'),
              note: z.string().optional().describe('New note'),
            }),
            execute: async ({
              id,
              title,
              tags,
              note,
            }: {
              id: string
              title?: string
              tags?: string[]
              note?: string
            }) => {
              const state = getState(stateId)
              const bookmark = state.bookmarks.get(id)

              if (!bookmark) {
                return { error: `Bookmark "${id}" not found.` }
              }

              if (title !== undefined) bookmark.title = title
              if (tags !== undefined) bookmark.tags = tags.map((t) => t.toLowerCase().trim()).filter(Boolean)
              if (note !== undefined) bookmark.note = note || undefined

              return {
                status: 'updated',
                bookmark: formatBookmark(bookmark),
                message: `✏️ Updated: "${bookmark.title}"`,
              }
            },
          }),
      },
    },

    async activate() {
      ctx.log.info('Bookmarks plugin activated')
    },

    async deactivate() {
      states.delete(stateId)
      ctx.log.info('Bookmarks plugin deactivated')
    },
  }
}
