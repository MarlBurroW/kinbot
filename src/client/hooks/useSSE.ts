import { useEffect, useRef } from 'react'

type SSEEventHandler = (data: Record<string, unknown>) => void
type HandlersMap = Record<string, SSEEventHandler>

// ---------------------------------------------------------------------------
// Singleton EventSource — one connection shared by all useSSE consumers.
// State is persisted across Vite HMR via import.meta.hot.data so that
// hot-reloads don't orphan the SSE connection.
// ---------------------------------------------------------------------------

interface SSEState {
  eventSource: EventSource | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  subscribers: Set<React.MutableRefObject<HandlersMap>>
}

function getState(): SSEState {
  if (import.meta.hot?.data?.sseState) {
    return import.meta.hot.data.sseState as SSEState
  }
  const state: SSEState = {
    eventSource: null,
    reconnectTimer: null,
    subscribers: new Set(),
  }
  if (import.meta.hot) {
    import.meta.hot.data.sseState = state
  }
  return state
}

const state = getState()

function dispatch(data: Record<string, unknown>) {
  const type = data.type as string
  for (const ref of state.subscribers) {
    const handler = ref.current[type]
    if (handler) {
      try {
        handler(data)
      } catch {
        // Ignore handler errors
      }
    }
  }
}

function connect() {
  if (state.eventSource) return

  const es = new EventSource('/api/sse', { withCredentials: true })
  state.eventSource = es

  es.addEventListener('message', (event) => {
    try {
      dispatch(JSON.parse(event.data) as Record<string, unknown>)
    } catch {
      // Ignore parse errors
    }
  })

  es.addEventListener('connected', () => {
    console.log('[SSE] Connected')
  })

  es.onerror = () => {
    es.close()
    state.eventSource = null
    // Reconnect only if there are still active subscribers
    if (state.subscribers.size > 0) {
      state.reconnectTimer = setTimeout(connect, 3000)
    }
  }
}

function teardown() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
  if (state.eventSource) {
    state.eventSource.close()
    state.eventSource = null
  }
}

// ---------------------------------------------------------------------------
// Hook — multiple hooks share the same connection
// ---------------------------------------------------------------------------

export function useSSE(handlers: HandlersMap) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    state.subscribers.add(handlersRef)
    connect()

    return () => {
      state.subscribers.delete(handlersRef)
      if (state.subscribers.size === 0) teardown()
    }
  }, [])
}
