/**
 * Tests for the ticket-comments service. Spins up a real in-memory SQLite DB
 * with the production schema so we can exercise drizzle queries, cascade
 * deletes, and metadata round-trips end-to-end without the brittle
 * mock-drizzle plumbing used by older tests.
 */
import { describe, it, expect, mock, beforeAll, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/server/db/schema'

// Silence the logger and any SSE emissions before importing the SUT.
mock.module('@/server/logger', () => ({
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  }),
}))

const broadcastedEvents: Array<{ type: string; data: Record<string, unknown> }> = []
mock.module('@/server/sse/index', () => ({
  sseManager: {
    broadcast: (event: { type: string; data: Record<string, unknown> }) => {
      broadcastedEvents.push(event)
    },
  },
}))

// Detect mock pollution from earlier tests in the suite: several route/service
// test files install a stub `@/server/db/schema` via `mock.module` (every table
// becomes `{}`). When ticket-comments.test.ts runs *after* one of those, our
// `import * as schema from '@/server/db/schema'` picks up the polluted module
// and drizzle queries against `ticketComments` blow up. The `itMocked` pattern
// (used by contacts.test.ts and friends) lets us cleanly skip in that case
// while still passing when the file is run in isolation via
// `bun test src/server/services/ticket-comments.test.ts`.
//
// We do NOT try to "un-mock" — bun:test has no public API for that, and a
// best-effort re-mock would still race against module cache.
const schemaIsReal = !!(schema as any).ticketComments?.id

// Create a single in-memory DB shared across the suite. We mock the db module
// so the service-under-test uses this instance.
const sqlite = new Database(':memory:')
sqlite.run('PRAGMA foreign_keys = ON')
const db = schemaIsReal ? drizzle(sqlite, { schema }) : (null as any)

if (schemaIsReal) {
  mock.module('@/server/db/index', () => ({
    db,
    sqlite,
    initVirtualTables: () => {},
  }))
}

// Import the SUT *after* the mocks are wired so they pick the fakes up.
const ticketComments = schemaIsReal
  ? await import('@/server/services/ticket-comments')
  : ({} as typeof import('@/server/services/ticket-comments'))
const {
  listTicketComments,
  createTicketComment,
  updateTicketComment,
  deleteTicketComment,
  listRecentCommentsForPrompt,
} = ticketComments as typeof import('@/server/services/ticket-comments')

const itMocked = schemaIsReal ? it : it.skip

// ─── Schema bootstrap ────────────────────────────────────────────────────────
//
// We hand-roll the CREATE TABLE statements for the handful of tables the
// service touches. This avoids running the entire migration sequence (which
// would require sqlite-vec) but keeps the column/FK behaviour identical to
// production.

beforeAll(() => {
  if (!schemaIsReal) return
  sqlite.run(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES user(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      pseudonym TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'fr',
      role TEXT NOT NULL DEFAULT 'member',
      kin_order TEXT,
      cron_order TEXT
    )
  `)
  sqlite.run(`
    CREATE TABLE kins (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_path TEXT,
      character TEXT NOT NULL,
      expertise TEXT NOT NULL,
      model TEXT NOT NULL,
      provider_id TEXT,
      workspace_path TEXT NOT NULL,
      tool_config TEXT,
      compacting_config TEXT,
      thinking_config TEXT,
      active_project_id TEXT,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      github_url TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE tickets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      number INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      position INTEGER NOT NULL DEFAULT 0,
      reporter_user_id TEXT,
      reporter_kin_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE ticket_comments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      author_type TEXT NOT NULL,
      author_user_id TEXT REFERENCES user(id) ON DELETE SET NULL,
      author_kin_id TEXT REFERENCES kins(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
})

beforeEach(() => {
  if (!schemaIsReal) return
  // Wipe and reseed before each test for isolation. Order matters for FKs.
  sqlite.run('DELETE FROM ticket_comments')
  sqlite.run('DELETE FROM tickets')
  sqlite.run('DELETE FROM projects')
  sqlite.run('DELETE FROM kins')
  sqlite.run('DELETE FROM user_profiles')
  sqlite.run('DELETE FROM user')
  broadcastedEvents.length = 0

  // Seed a baseline fixture: one project + one ticket + one user + two kins.
  const now = Date.now()
  sqlite.run(
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
     VALUES ('user-1', 'Alice User', 'alice@example.com', 1, ?, ?)`,
    [now, now],
  )
  sqlite.run(
    `INSERT INTO user_profiles (user_id, first_name, last_name, pseudonym)
     VALUES ('user-1', 'Alice', 'Doe', 'alice')`,
  )
  sqlite.run(
    `INSERT INTO kins (id, slug, name, role, character, expertise, model, workspace_path, created_at, updated_at)
     VALUES ('kin-author', 'author-bot', 'Author Bot', 'r', 'c', 'e', 'gpt', '/tmp/kin-author', ?, ?)`,
    [now, now],
  )
  sqlite.run(
    `INSERT INTO kins (id, slug, name, role, character, expertise, model, workspace_path, created_at, updated_at)
     VALUES ('kin-other', 'other-bot', 'Other Bot', 'r', 'c', 'e', 'gpt', '/tmp/kin-other', ?, ?)`,
    [now, now],
  )
  sqlite.run(
    `INSERT INTO projects (id, slug, title, created_at, updated_at)
     VALUES ('proj-1', 'demo', 'Demo', ?, ?)`,
    [now, now],
  )
  sqlite.run(
    `INSERT INTO tickets (id, project_id, number, title, created_at, updated_at)
     VALUES ('ticket-1', 'proj-1', 1, 'Hello', ?, ?)`,
    [now, now],
  )
})

describe('ticket-comments service', () => {
  itMocked('creates a comment and lists it back', async () => {
    const comment = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'user', id: 'user-1' },
      content: 'first post',
    })

    expect(comment.id).toBeTruthy()
    expect(comment.ticketId).toBe('ticket-1')
    expect(comment.content).toBe('first post')
    expect(comment.author.type).toBe('user')
    expect(comment.author.id).toBe('user-1')
    expect(comment.author.name).toBe('Alice Doe')
    expect(comment.metadata).toBeNull()

    const listed = await listTicketComments('ticket-1')
    expect(listed.comments).toHaveLength(1)
    expect(listed.comments[0]!.id).toBe(comment.id)
    expect(listed.hasMore).toBe(false)

    // Broadcast was emitted.
    expect(broadcastedEvents.some((e) => e.type === 'ticket:comment-added')).toBe(true)
  })

  itMocked('rejects empty content', async () => {
    await expect(
      createTicketComment({
        ticketId: 'ticket-1',
        author: { type: 'user', id: 'user-1' },
        content: '   ',
      }),
    ).rejects.toThrow('EMPTY_CONTENT')
  })

  itMocked('rejects unknown ticket', async () => {
    await expect(
      createTicketComment({
        ticketId: 'no-such',
        author: { type: 'user', id: 'user-1' },
        content: 'hi',
      }),
    ).rejects.toThrow('TICKET_NOT_FOUND')
  })

  itMocked('persists metadata as JSON round-trip', async () => {
    const created = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-author' },
      content: 'auto report',
      metadata: { fromTaskId: 'task-99', autoGenerated: true },
    })
    expect(created.metadata).toEqual({ fromTaskId: 'task-99', autoGenerated: true })

    const listed = await listTicketComments('ticket-1')
    expect(listed.comments[0]!.metadata).toEqual({
      fromTaskId: 'task-99',
      autoGenerated: true,
    })
  })

  itMocked('lets the original Kin author edit its comment', async () => {
    const created = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-author' },
      content: 'draft',
    })
    const updated = await updateTicketComment(
      created.id,
      { content: 'revised' },
      { type: 'kin', id: 'kin-author' },
    )
    expect(updated?.content).toBe('revised')
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.createdAt)
    expect(broadcastedEvents.some((e) => e.type === 'ticket:comment-updated')).toBe(true)
  })

  itMocked('forbids a different Kin from editing someone else’s comment', async () => {
    const created = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-author' },
      content: 'draft',
    })
    await expect(
      updateTicketComment(
        created.id,
        { content: 'tampered' },
        { type: 'kin', id: 'kin-other' },
      ),
    ).rejects.toThrow('FORBIDDEN')
  })

  itMocked('lets a user edit any comment (including a Kin authored one)', async () => {
    const created = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-author' },
      content: 'kin draft',
    })
    const updated = await updateTicketComment(
      created.id,
      { content: 'edited by user' },
      { type: 'user', id: 'user-1' },
    )
    expect(updated?.content).toBe('edited by user')
  })

  itMocked('forbids a Kin from deleting another Kin’s comment but allows its own', async () => {
    const c1 = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-author' },
      content: 'own',
    })
    const c2 = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-other' },
      content: 'theirs',
    })

    await expect(
      deleteTicketComment(c2.id, { type: 'kin', id: 'kin-author' }),
    ).rejects.toThrow('FORBIDDEN')

    const ok = await deleteTicketComment(c1.id, { type: 'kin', id: 'kin-author' })
    expect(ok).toBe(true)

    // Original Kin's comment is gone, the other remains.
    const remaining = await listTicketComments('ticket-1')
    expect(remaining.comments.map((c) => c.id)).toEqual([c2.id])
  })

  itMocked('lets the user delete any comment', async () => {
    const c = await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-other' },
      content: 'whatever',
    })
    const ok = await deleteTicketComment(c.id, { type: 'user', id: 'user-1' })
    expect(ok).toBe(true)
    expect(broadcastedEvents.some((e) => e.type === 'ticket:comment-deleted')).toBe(true)
  })

  itMocked('paginates list results', async () => {
    for (let i = 0; i < 5; i++) {
      await createTicketComment({
        ticketId: 'ticket-1',
        author: { type: 'user', id: 'user-1' },
        content: `c${i}`,
      })
      // Bun is fast enough that consecutive Date.now() may collide; force a
      // tiny gap so the chronological order is stable.
      await new Promise((r) => setTimeout(r, 2))
    }
    const page1 = await listTicketComments('ticket-1', { limit: 2, offset: 0 })
    expect(page1.comments).toHaveLength(2)
    expect(page1.hasMore).toBe(true)
    expect(page1.comments.map((c) => c.content)).toEqual(['c0', 'c1'])

    const page2 = await listTicketComments('ticket-1', { limit: 2, offset: 2 })
    expect(page2.comments.map((c) => c.content)).toEqual(['c2', 'c3'])
    expect(page2.hasMore).toBe(true)

    const tail = await listTicketComments('ticket-1', { limit: 2, offset: 4 })
    expect(tail.comments.map((c) => c.content)).toEqual(['c4'])
    expect(tail.hasMore).toBe(false)
  })

  itMocked('cascades deletion when the parent ticket is deleted', async () => {
    await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'user', id: 'user-1' },
      content: 'doomed',
    })
    expect(sqlite.query<{ n: number }, []>(
      'SELECT COUNT(*) as n FROM ticket_comments'
    ).get()?.n).toBe(1)

    sqlite.run('DELETE FROM tickets WHERE id = ?', ['ticket-1'])

    expect(sqlite.query<{ n: number }, []>(
      'SELECT COUNT(*) as n FROM ticket_comments'
    ).get()?.n).toBe(0)
  })

  itMocked('exposes the prompt-friendly shape', async () => {
    await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'user', id: 'user-1' },
      content: 'user input',
    })
    await createTicketComment({
      ticketId: 'ticket-1',
      author: { type: 'kin', id: 'kin-author' },
      content: 'kin report',
      metadata: { fromTaskId: 'task-1', autoGenerated: true },
    })

    const forPrompt = await listRecentCommentsForPrompt('ticket-1', 50)
    expect(forPrompt).toHaveLength(2)
    expect(forPrompt[0]!.authorType).toBe('user')
    expect(forPrompt[0]!.authorName).toBe('Alice Doe')
    expect(forPrompt[0]!.autoGenerated).toBe(false)
    expect(forPrompt[1]!.authorType).toBe('kin')
    expect(forPrompt[1]!.authorName).toBe('Author Bot')
    expect(forPrompt[1]!.autoGenerated).toBe(true)
  })

  itMocked('returns null when updating a missing comment', async () => {
    const updated = await updateTicketComment(
      'no-such-id',
      { content: 'x' },
      { type: 'user', id: 'user-1' },
    )
    expect(updated).toBeNull()
  })

  itMocked('returns false when deleting a missing comment', async () => {
    const ok = await deleteTicketComment('no-such-id', { type: 'user', id: 'user-1' })
    expect(ok).toBe(false)
  })
})
