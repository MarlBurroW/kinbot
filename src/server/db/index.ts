import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { config } from '@/server/config'
import * as schema from '@/server/db/schema'
import { mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'

// Ensure data directory exists
const dbDir = dirname(config.db.path)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(config.db.path)

// Enable WAL mode for better concurrency
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA foreign_keys = ON')
sqlite.run('PRAGMA busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })
export { sqlite }

/**
 * Initialize virtual tables (FTS5, sqlite-vec) that Drizzle doesn't manage.
 * Called once at startup after Drizzle migrations have run.
 */
export function initVirtualTables() {
  // FTS5: full-text search on memories
  sqlite.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content_rowid='rowid',
      tokenize='unicode61'
    )
  `)

  // FTS5: full-text search on messages
  sqlite.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      content_rowid='rowid',
      tokenize='unicode61'
    )
  `)

  // Triggers to sync memories_fts with memories
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories
    WHEN new.content IS NOT NULL
    BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
    END
  `)
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE OF content ON memories
    WHEN new.content IS NOT NULL
    BEGIN
      UPDATE memories_fts SET content = new.content WHERE rowid = old.rowid;
    END
  `)
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories
    BEGIN
      DELETE FROM memories_fts WHERE rowid = old.rowid;
    END
  `)

  // Triggers to sync messages_fts with messages
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages
    WHEN new.content IS NOT NULL
    BEGIN
      INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
    END
  `)
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE OF content ON messages
    WHEN new.content IS NOT NULL
    BEGIN
      UPDATE messages_fts SET content = new.content WHERE rowid = old.rowid;
    END
  `)
  sqlite.run(`
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages
    BEGIN
      DELETE FROM messages_fts WHERE rowid = old.rowid;
    END
  `)

  // sqlite-vec: vector search on memory embeddings
  // Note: sqlite-vec extension must be loaded. This may fail if the extension
  // is not available — we'll handle that gracefully in later phases.
  try {
    sqlite.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_vec USING vec0(
        memory_id text PRIMARY KEY,
        embedding float[${config.memory.embeddingDimension}]
      )
    `)
  } catch {
    console.warn(
      'sqlite-vec extension not available. Vector search will be disabled. ' +
      'Install sqlite-vec for full memory search capabilities.'
    )
  }
}
