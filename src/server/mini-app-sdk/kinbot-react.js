/**
 * KinBot React SDK — ES Module
 * Served at /api/mini-apps/sdk/kinbot-react.js
 *
 * Provides React hooks that layer on top of the vanilla KinBot SDK (window.KinBot).
 * The vanilla SDK is always auto-injected as a regular <script> before any ES modules,
 * so window.KinBot is guaranteed to exist when this module runs.
 *
 * Usage in mini-apps:
 *   import { useState } from 'react'
 *   import { createRoot } from 'react-dom/client'
 *   import { useKinBot, useStorage, toast } from '@kinbot/react'
 *
 *   function App() {
 *     const { app, ready } = useKinBot()
 *     const [todos, setTodos, loading] = useStorage('todos', [])
 *     if (!ready || loading) return <div>Loading...</div>
 *     return <div>{app.name}</div>
 *   }
 *
 *   createRoot(document.getElementById('root')).render(<App />)
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── useKinBot ──────────────────────────────────────────────────────────────

/**
 * Core hook — manages KinBot.ready() lifecycle and provides reactive app state.
 * Call once at the root of your app. All other hooks can be used independently.
 *
 * @returns {{ app: object|null, ready: boolean, theme: {mode,palette}, locale: string, isFullPage: boolean, api: object }}
 */
export function useKinBot() {
  const [app, setApp] = useState(null)
  const [ready, setReady] = useState(false)
  const [theme, setTheme] = useState(window.KinBot.theme)
  const [locale, setLocale] = useState(window.KinBot.locale)
  const [isFullPage, setIsFullPage] = useState(window.KinBot.isFullPage)

  useEffect(() => {
    let mounted = true

    window.KinBot.ready().then((meta) => {
      if (mounted) {
        setApp(meta)
        setReady(true)
      }
    })

    const offTheme = window.KinBot.on('theme-changed', (t) => {
      if (mounted) setTheme(t)
    })
    const offLocale = window.KinBot.on('locale-changed', (d) => {
      if (mounted) setLocale(d.locale)
    })
    const offFullpage = window.KinBot.on('fullpage-changed', (d) => {
      if (mounted) setIsFullPage(d.isFullPage)
    })

    return () => {
      mounted = false
      offTheme()
      offLocale()
      offFullpage()
    }
  }, [])

  return { app, ready, theme, locale, isFullPage, api: window.KinBot.api }
}

// ─── useStorage ─────────────────────────────────────────────────────────────

/**
 * Reactive key-value storage hook backed by KinBot.storage.
 * Automatically loads the initial value and persists on every set call.
 * Awaits KinBot.ready() internally, so it's safe to use anywhere.
 *
 * @param {string} key — storage key
 * @param {any} defaultValue — value to use until loaded or if key doesn't exist
 * @returns {[value, setValue, loading]} — like useState + loading flag
 */
export function useStorage(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [loading, setLoading] = useState(true)
  const valueRef = useRef(defaultValue)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)

    window.KinBot.ready()
      .then(() => window.KinBot.storage.get(key))
      .then((stored) => {
        if (mountedRef.current && stored != null) {
          setValue(stored)
          valueRef.current = stored
        }
      })
      .catch((err) => {
        console.error('[KinBot React] useStorage load failed:', err)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })

    return () => {
      mountedRef.current = false
    }
  }, [key])

  const set = useCallback(
    (newValue) => {
      const val = typeof newValue === 'function' ? newValue(valueRef.current) : newValue
      setValue(val)
      valueRef.current = val
      window.KinBot.storage.set(key, val).catch((err) => {
        console.error('[KinBot React] useStorage save failed:', err)
      })
    },
    [key],
  )

  return [value, set, loading]
}

// ─── useTheme ───────────────────────────────────────────────────────────────

/**
 * Lightweight reactive theme hook.
 * Use this instead of useKinBot() when you only need theme info.
 *
 * @returns {{ mode: 'light'|'dark', palette: string }}
 */
export function useTheme() {
  const [theme, setTheme] = useState(window.KinBot.theme)

  useEffect(() => {
    return window.KinBot.on('theme-changed', setTheme)
  }, [])

  return theme
}

// ─── Convenience re-exports from vanilla SDK ─────────────────────────────────

export const toast = window.KinBot.toast
export const confirm = window.KinBot.confirm
export const prompt = window.KinBot.prompt
export const navigate = window.KinBot.navigate
export const fullpage = window.KinBot.fullpage
export const setTitle = window.KinBot.setTitle
export const setBadge = window.KinBot.setBadge
export const openApp = window.KinBot.openApp
export const clipboard = window.KinBot.clipboard
export const storage = window.KinBot.storage
export const api = window.KinBot.api
export const http = window.KinBot.http
export const events = window.KinBot.events
