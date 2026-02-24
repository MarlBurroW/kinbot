import { useEffect, useRef, useSyncExternalStore } from 'react'

type SSEEventHandler = (data: Record<string, unknown>) => void
type HandlersMap = Record<string, SSEEventHandler>

// ---------------------------------------------------------------------------
// Connection status — observable by useSSEStatus()
// ---------------------------------------------------------------------------

export type SSEConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

type StatusListener = () => void

interface StatusStore {
  status: SSEConnectionStatus
  listeners: Set<StatusListener>
}

function getStatusStore(): StatusStore {
  if (import.meta.hot?.data?.sseStatusStore) {
    return import.meta.hot.data.sseStatusStore as StatusStore
  }
  const store: StatusStore = { status: 'disconnected', listeners: new Set() }
  if (import.meta.hot) {
    import.meta.hot.data.sseStatusStore = store
  }
  return store
}

const statusStore = getStatusStore()

function setStatus(next: SSEConnectionStatus) {
  if (statusStore.status === next) return
  statusStore.status = next
  for (const listener of statusStore.listeners) {
    listener()
  }
}

// ---------------------------------------------------------------------------
// Singleton EventSource — one connection shared by all useSSE consumers.
// State is persisted across Vite HMR via import.meta.hot.data so that
// hot-reloads don't orphan the SSE connection.
// ---------------------------------------------------------------------------

interface SSEState {
  eventSource: EventSource | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  teardownTimer: ReturnType<typeof setTimeout> | null
  subscribers: Set<React.MutableRefObject<HandlersMap>>
}

function getState(): SSEState {
  if (import.meta.hot?.data?.sseState) {
    return import.meta.hot.data.sseState as SSEState
  }
  const state: SSEState = {
    eventSource: null,
    reconnectTimer: null,
    teardownTimer: null,
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
  // Clean up stale EventSource that got into CLOSED state without onerror
  if (state.eventSource && state.eventSource.readyState === EventSource.CLOSED) {
    state.eventSource = null
  }
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
    setStatus('connected')
  })

  es.onerror = () => {
    es.close()
    state.eventSource = null
    setStatus('reconnecting')
    // Always schedule reconnect — during HMR, subscribers may temporarily be 0
    // but components will remount shortly. The teardown grace period handles
    // the case where the page is truly unloading.
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (state.reconnectTimer) return // Already scheduled
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null
    connect()
  }, 3000)
}

function teardown() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
  if (state.teardownTimer) {
    clearTimeout(state.teardownTimer)
    state.teardownTimer = null
  }
  if (state.eventSource) {
    state.eventSource.close()
    state.eventSource = null
  }
  setStatus('disconnected')
}

// ---------------------------------------------------------------------------
// Hook — multiple hooks share the same connection
// ---------------------------------------------------------------------------

export function useSSE(handlers: HandlersMap) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    // Cancel any pending teardown — a new subscriber is mounting
    if (state.teardownTimer) {
      clearTimeout(state.teardownTimer)
      state.teardownTimer = null
    }
    state.subscribers.add(handlersRef)
    connect()

    return () => {
      state.subscribers.delete(handlersRef)
      if (state.subscribers.size === 0) {
        // Grace period: during HMR, components unmount then remount quickly.
        // Wait before tearing down so we don't kill the connection needlessly.
        state.teardownTimer = setTimeout(teardown, 5000)
      }
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Status hook — subscribe to connection state changes
// ---------------------------------------------------------------------------

function subscribeStatus(listener: StatusListener) {
  statusStore.listeners.add(listener)
  return () => { statusStore.listeners.delete(listener) }
}

function getStatusSnapshot(): SSEConnectionStatus {
  return statusStore.status
}

export function useSSEStatus(): SSEConnectionStatus {
  return useSyncExternalStore(subscribeStatus, getStatusSnapshot)
}

// ---------------------------------------------------------------------------
// HMR — self-accept so Vite doesn't bubble up and cause a full reload.
// The state is already persisted in import.meta.hot.data, so re-evaluation
// of this module just picks up where it left off.
// ---------------------------------------------------------------------------
if (import.meta.hot) {
  import.meta.hot.accept()
}
