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

// 2 attempts is enough to ride out a transient blip (server restart, brief
// network glitch); past that the most likely cause is an expired session,
// and continuing to retry just floods the server with 401s — especially
// across multiple stale tabs. resetSSE() rearms after a successful login.
const MAX_CONSECUTIVE_FAILURES = 2
const BASE_RECONNECT_MS = 3000
const MAX_RECONNECT_MS = 60000

type ResyncListener = () => void

interface SSEState {
  eventSource: EventSource | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  teardownTimer: ReturnType<typeof setTimeout> | null
  subscribers: Set<React.MutableRefObject<HandlersMap>>
  consecutiveFailures: number
  // Resync: SSE never replays events missed while the tab/app was backgrounded
  // or the connection was down, so reconnecting is not enough — consumers must
  // refetch their state. These listeners fire on resume / reconnect.
  resyncListeners: Set<ResyncListener>
  lastResyncAt: number
  // True once we've had at least one successful connection — lets us tell a
  // reconnect (resync needed) apart from the very first connect (consumers do
  // their own initial load).
  hasEverConnected: boolean
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
    consecutiveFailures: 0,
    resyncListeners: new Set(),
    lastResyncAt: 0,
    hasEverConnected: false,
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

// Throttle so a burst of resume signals (e.g. mobile unlock fires
// visibilitychange AND the reconnect's `connected` shortly after) only triggers
// one round of refetches.
const RESYNC_THROTTLE_MS = 2000

function notifyResync() {
  const now = Date.now()
  if (now - state.lastResyncAt < RESYNC_THROTTLE_MS) return
  state.lastResyncAt = now
  for (const listener of state.resyncListeners) {
    try {
      listener()
    } catch {
      // Ignore listener errors
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
    state.consecutiveFailures = 0
    // A reconnect (we were connected before) means we likely missed events
    // while the stream was down — tell consumers to refetch. The very first
    // connect is skipped: consumers load their own initial state on mount.
    const wasReconnect = state.hasEverConnected
    state.hasEverConnected = true
    setStatus('connected')
    if (wasReconnect) notifyResync()
  })

  es.onerror = () => {
    es.close()
    state.eventSource = null
    state.consecutiveFailures++

    // After too many consecutive failures (likely expired session), stop
    // retrying to avoid flooding the server with 401s. resetSSE() will
    // restart the connection after a successful login.
    if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      setStatus('disconnected')
      return
    }

    setStatus('reconnecting')
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (state.reconnectTimer) return // Already scheduled
  const delay = Math.min(BASE_RECONNECT_MS * 2 ** (state.consecutiveFailures - 1), MAX_RECONNECT_MS)
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null
    connect()
  }, delay)
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
    attachRecoveryListeners()
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
// Resync hook — register a callback that runs when the client should re-pull
// its state because it may have missed SSE events (tab/app returned to the
// foreground, or the connection dropped and recovered). SSE does not replay
// missed events, so a view that only listens to live events would otherwise
// stay frozen on stale data until a manual refresh.
// ---------------------------------------------------------------------------

export function useSSEResync(callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const listener: ResyncListener = () => callbackRef.current()
    state.resyncListeners.add(listener)
    return () => {
      state.resyncListeners.delete(listener)
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Reset — call after login to restart SSE after auth-related failures
// ---------------------------------------------------------------------------

export function resetSSE() {
  state.consecutiveFailures = 0
  // If already connected, nothing to do
  if (state.eventSource && state.eventSource.readyState !== EventSource.CLOSED) return
  // If a reconnect is already scheduled, let it proceed with reset counter
  if (state.reconnectTimer) return
  // Only reconnect if there are active subscribers
  if (state.subscribers.size > 0) {
    connect()
  }
}

// ---------------------------------------------------------------------------
// Recovery — once we hit MAX_CONSECUTIVE_FAILURES we stop retrying and sit in
// 'disconnected' until something tells us the world might have changed. The
// classic case: a backgrounded tab whose connection dropped (server restart,
// laptop sleep, network blip). The user comes back to a red banner because
// nothing re-armed the connection. Reconnect immediately when the tab becomes
// visible / regains focus / the network comes back, so no manual refresh is
// needed.
// ---------------------------------------------------------------------------

function reconnectNow() {
  if (state.subscribers.size === 0) return
  // Already healthy — leave it alone.
  if (state.eventSource && state.eventSource.readyState !== EventSource.CLOSED) return
  // Reset the give-up counter and cancel any long backoff so we retry now
  // instead of waiting out the (up to 60s) delay.
  state.consecutiveFailures = 0
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
  connect()
}

// Module-level so it survives every useSSE mount (one instance in prod);
// seeded from hot.data so a Vite HMR re-eval doesn't re-attach duplicates.
let recoveryAttached = Boolean(import.meta.hot?.data?.sseRecoveryAttached)

function attachRecoveryListeners() {
  if (recoveryAttached) return
  if (typeof window === 'undefined') return
  recoveryAttached = true
  if (import.meta.hot) import.meta.hot.data.sseRecoveryAttached = true

  const tryRecover = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    reconnectNow()
  }

  // The page/app came back to the foreground (or the network returned). Beyond
  // reconnecting a dead stream, we MUST refetch: while backgrounded — a locked
  // phone is the textbook case — the conversation may have advanced elsewhere
  // and those events are gone (SSE has no replay). The throttle in notifyResync
  // collapses this with the reconnect's own resync.
  const onResume = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    reconnectNow()
    notifyResync()
  }

  window.addEventListener('online', onResume)
  window.addEventListener('focus', tryRecover)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onResume()
    })
  }
  // iOS Safari freezes a backgrounded page and restores it from the bfcache;
  // visibilitychange is unreliable there, but pageshow with persisted=true
  // fires on every restore.
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) onResume()
  })
}

// ---------------------------------------------------------------------------
// HMR — self-accept so Vite doesn't bubble up and cause a full reload.
// The state is already persisted in import.meta.hot.data, so re-evaluation
// of this module just picks up where it left off.
// ---------------------------------------------------------------------------
if (import.meta.hot) {
  import.meta.hot.accept()
}
