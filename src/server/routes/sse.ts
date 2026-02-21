import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { v4 as uuid } from 'uuid'
import { sseManager } from '@/server/sse/index'

const sseRoutes = new Hono()

// GET /api/sse — global SSE connection (one per client)
sseRoutes.get('/', (c) => {
  const user = c.get('user') as { id: string }

  return streamSSE(c, async (stream) => {
    const connectionId = uuid()

    sseManager.addConnection(connectionId, {
      write: (data: string) => {
        stream.writeSSE({ data, event: 'message' }).catch(() => {
          // stream might be closed
        })
      },
      close: () => {
        stream.close()
      },
      userId: user.id,
    })

    // Send connected event
    await stream.writeSSE({
      data: JSON.stringify({ type: 'connected', connectionId }),
      event: 'connected',
    })

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      stream.writeSSE({
        data: JSON.stringify({ type: 'ping', timestamp: Date.now() }),
        event: 'ping',
      }).catch(() => {
        clearInterval(pingInterval)
      })
    }, 15000)

    // Wait for disconnect
    stream.onAbort(() => {
      clearInterval(pingInterval)
      sseManager.removeConnection(connectionId)
    })

    // Keep stream alive
    await new Promise(() => {
      // Never resolves — stream stays open until client disconnects
    })
  })
})

export { sseRoutes }
