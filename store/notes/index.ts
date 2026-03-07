import { tool } from 'ai'
import { z } from 'zod'

/**
 * Notes plugin for KinBot.
 * Quick note-taking with tags, pinning, and search.
 */

interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  createdAt: number
  updatedAt: number
}

interface NotesState {
  notes: Map<string, Note>
  nextId: number
}

const states = new Map<string, NotesState>()

function getState(id: string): NotesState {
  if (!states.has(id)) {
    states.set(id, { notes: new Map(), nextId: 1 })
  }
  return states.get(id)!
}

function generateId(state: NotesState): string {
  return `note-${state.nextId++}`
}

function matchesQuery(note: Note, query: string): boolean {
  const q = query.toLowerCase()
  return (
    note.title.toLowerCase().includes(q) ||
    note.content.toLowerCase().includes(q) ||
    note.tags.some((t) => t.toLowerCase().includes(q))
  )
}

function formatNote(n: Note): object {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    tags: n.tags,
    pinned: n.pinned,
    created: new Date(n.createdAt).toISOString(),
    updated: new Date(n.updatedAt).toISOString(),
  }
}

export default function (ctx: any) {
  const maxNotes = parseInt(ctx.config.maxNotes || '250', 10)
  const stateId = ctx.manifest?.name || ctx.kinId || 'default'

  return {
    tools: {
      note_create: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Create a new note. Use when the user wants to jot down an idea, reminder, or snippet of information.',
            inputSchema: z.object({
              title: z.string().describe('Short title for the note'),
              content: z.string().describe('The note content (supports markdown)'),
              tags: z
                .array(z.string())
                .optional()
                .describe('Tags for categorization (e.g. ["idea", "work", "recipe"])'),
              pinned: z.boolean().optional().describe('Pin this note to the top (default: false)'),
            }),
            execute: async ({ title, content, tags, pinned }) => {
              const state = getState(stateId)
              if (state.notes.size >= maxNotes) {
                return { error: `Note limit reached (${maxNotes}). Delete some notes first.` }
              }
              const now = Date.now()
              const id = generateId(state)
              const note: Note = {
                id,
                title,
                content,
                tags: tags || [],
                pinned: pinned || false,
                createdAt: now,
                updatedAt: now,
              }
              state.notes.set(id, note)
              return { saved: formatNote(note), total: state.notes.size }
            },
          }),
      },

      note_update: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Update an existing note. Provide the note ID and the fields to change.',
            inputSchema: z.object({
              id: z.string().describe('The note ID to update'),
              title: z.string().optional().describe('New title'),
              content: z.string().optional().describe('New content'),
              tags: z.array(z.string()).optional().describe('Replace tags'),
              pinned: z.boolean().optional().describe('Pin or unpin'),
            }),
            execute: async ({ id, title, content, tags, pinned }) => {
              const state = getState(stateId)
              const note = state.notes.get(id)
              if (!note) return { error: `Note ${id} not found.` }
              if (title !== undefined) note.title = title
              if (content !== undefined) note.content = content
              if (tags !== undefined) note.tags = tags
              if (pinned !== undefined) note.pinned = pinned
              note.updatedAt = Date.now()
              return { updated: formatNote(note) }
            },
          }),
      },

      note_delete: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Delete a note by ID.',
            inputSchema: z.object({
              id: z.string().describe('The note ID to delete'),
            }),
            execute: async ({ id }) => {
              const state = getState(stateId)
              const note = state.notes.get(id)
              if (!note) return { error: `Note ${id} not found.` }
              state.notes.delete(id)
              return { deleted: id, title: note.title, remaining: state.notes.size }
            },
          }),
      },

      note_search: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description:
              'Search notes by keyword. Matches against title, content, and tags. Returns pinned notes first.',
            inputSchema: z.object({
              query: z.string().optional().describe('Search query (omit to list all notes)'),
              tag: z.string().optional().describe('Filter by a specific tag'),
              pinnedOnly: z.boolean().optional().describe('Only return pinned notes'),
              limit: z.number().optional().describe('Max results (default: 20)'),
            }),
            execute: async ({ query, tag, pinnedOnly, limit }) => {
              const state = getState(stateId)
              let results = Array.from(state.notes.values())

              if (query) {
                results = results.filter((n) => matchesQuery(n, query))
              }
              if (tag) {
                const t = tag.toLowerCase()
                results = results.filter((n) => n.tags.some((nt) => nt.toLowerCase() === t))
              }
              if (pinnedOnly) {
                results = results.filter((n) => n.pinned)
              }

              // Pinned first, then by most recently updated
              results.sort((a, b) => {
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
                return b.updatedAt - a.updatedAt
              })

              const max = limit || 20
              const sliced = results.slice(0, max)

              return {
                results: sliced.map(formatNote),
                total: results.length,
                showing: sliced.length,
              }
            },
          }),
      },

      note_view: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'View a single note by ID with full content.',
            inputSchema: z.object({
              id: z.string().describe('The note ID to view'),
            }),
            execute: async ({ id }) => {
              const state = getState(stateId)
              const note = state.notes.get(id)
              if (!note) return { error: `Note ${id} not found.` }
              return { note: formatNote(note) }
            },
          }),
      },

      note_pin: {
        availability: ['main', 'sub-kin'] as const,
        create: () =>
          tool({
            description: 'Toggle pin status on a note. Pinned notes appear first in search results.',
            inputSchema: z.object({
              id: z.string().describe('The note ID to pin/unpin'),
            }),
            execute: async ({ id }) => {
              const state = getState(stateId)
              const note = state.notes.get(id)
              if (!note) return { error: `Note ${id} not found.` }
              note.pinned = !note.pinned
              note.updatedAt = Date.now()
              return { id, pinned: note.pinned, title: note.title }
            },
          }),
      },
    },
  }
}
