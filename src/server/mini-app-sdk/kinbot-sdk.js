/**
 * KinBot Mini-App SDK (JavaScript)
 * Auto-injected into mini-app iframes alongside kinbot-sdk.css.
 *
 * Provides:
 *   KinBot.theme   — current theme info (mode, palette)
 *   KinBot.app     — current app metadata (id, name, slug)
 *   KinBot.on()    — listen for events from the parent
 *   KinBot.emit()  — send events to the parent
 *   KinBot.toast() — show a toast notification in the parent UI
 *   KinBot.ready() — signal that the app has finished loading
 */
;(function () {
  'use strict'

  // ─── Internal state ─────────────────────────────────────────────────────

  var listeners = {} // event name → Set<callback>
  var _appMeta = null

  // ─── Theme ──────────────────────────────────────────────────────────────

  function getTheme() {
    var root = document.documentElement
    return {
      mode: root.classList.contains('dark') ? 'dark' : 'light',
      palette: root.getAttribute('data-palette') || 'aurora',
    }
  }

  // ─── Events ─────────────────────────────────────────────────────────────

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = new Set()
    listeners[event].add(callback)
    return function off() {
      if (listeners[event]) listeners[event].delete(callback)
    }
  }

  function _dispatch(event, data) {
    var cbs = listeners[event]
    if (cbs) {
      cbs.forEach(function (cb) {
        try { cb(data) } catch (e) { console.error('[KinBot SDK]', event, e) }
      })
    }
  }

  function emit(event, data) {
    try {
      parent.postMessage({ source: 'kinbot-sdk', type: 'emit', event: event, data: data }, '*')
    } catch (e) {
      console.warn('[KinBot SDK] emit failed:', e)
    }
  }

  // ─── Toast ──────────────────────────────────────────────────────────────

  /**
   * Show a toast in the parent KinBot UI.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'error'} [type='info']
   */
  function toast(message, type) {
    try {
      parent.postMessage({
        source: 'kinbot-sdk',
        type: 'toast',
        message: String(message).slice(0, 500),
        toastType: type || 'info',
      }, '*')
    } catch (e) {
      console.warn('[KinBot SDK] toast failed:', e)
    }
  }

  // ─── Navigate ───────────────────────────────────────────────────────────

  /**
   * Navigate the parent KinBot app to a path.
   * @param {string} path — e.g. '/kins' or '/settings'
   */
  function navigate(path) {
    try {
      parent.postMessage({
        source: 'kinbot-sdk',
        type: 'navigate',
        path: String(path),
      }, '*')
    } catch (e) {
      console.warn('[KinBot SDK] navigate failed:', e)
    }
  }

  // ─── Ready ──────────────────────────────────────────────────────────────

  function ready() {
    try {
      parent.postMessage({ source: 'kinbot-sdk', type: 'ready' }, '*')
    } catch (e) {}
  }

  // ─── Listen for messages from parent ────────────────────────────────────

  window.addEventListener('message', function (ev) {
    var msg = ev.data
    if (!msg || msg.source !== 'kinbot-parent') return

    if (msg.type === 'app-meta') {
      _appMeta = msg.data || null
      _dispatch('app-meta', _appMeta)
    } else if (msg.type === 'theme-changed') {
      _dispatch('theme-changed', getTheme())
    } else if (msg.type === 'event') {
      _dispatch(msg.event, msg.data)
    }
  })

  // ─── Theme change observer (local CSS class sync already done by theme script) ─

  try {
    new MutationObserver(function () {
      _dispatch('theme-changed', getTheme())
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-palette'],
    })
  } catch (e) {}

  // ─── Public API ─────────────────────────────────────────────────────────

  window.KinBot = {
    get theme() { return getTheme() },
    get app() { return _appMeta },
    on: on,
    emit: emit,
    toast: toast,
    navigate: navigate,
    ready: ready,
    version: '1.0.0',
  }
})()
