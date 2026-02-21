import type { SSEEvent } from '@/server/sse/types'
import { createLogger } from '@/server/logger'

const log = createLogger('sse')

type SSEWriter = {
  write: (data: string) => void
  close: () => void
  userId: string
}

class SSEManager {
  private connections = new Map<string, SSEWriter>()

  /**
   * Register a new SSE connection for a user.
   */
  addConnection(connectionId: string, writer: SSEWriter): void {
    this.connections.set(connectionId, writer)
    log.info({ connectionId, userId: writer.userId, total: this.connections.size }, 'SSE connection opened')
  }

  /**
   * Remove a connection when the client disconnects.
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId)
    log.info({ connectionId, total: this.connections.size }, 'SSE connection closed')
  }

  /**
   * Send an event to all connected clients.
   */
  broadcast(event: SSEEvent): void {
    const payload = formatSSE(event)
    for (const [, writer] of this.connections) {
      try {
        writer.write(payload)
      } catch {
        // Connection might be closed
      }
    }
  }

  /**
   * Send an event to a specific user's connections.
   */
  sendToUser(userId: string, event: SSEEvent): void {
    const payload = formatSSE(event)
    for (const [, writer] of this.connections) {
      if (writer.userId === userId) {
        try {
          writer.write(payload)
        } catch {
          // Connection might be closed
        }
      }
    }
  }

  /**
   * Send an event to all clients that care about a specific kinId.
   * For now, broadcast to all — future: track which clients are watching which kins.
   */
  sendToKin(kinId: string, event: SSEEvent): void {
    const payload = formatSSE({ ...event, kinId })
    for (const [, writer] of this.connections) {
      try {
        writer.write(payload)
      } catch {
        // Connection might be closed
      }
    }
  }

  get connectionCount(): number {
    return this.connections.size
  }
}

function formatSSE(event: SSEEvent): string {
  return JSON.stringify({ type: event.type, kinId: event.kinId, ...event.data })
}

export const sseManager = new SSEManager()
