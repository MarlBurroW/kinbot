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

// ─── useKin ─────────────────────────────────────────────────────────────────

/**
 * Reactive access to the parent Kin info (id, name, avatarUrl).
 * Waits for KinBot.ready() then returns KinBot.kin.
 *
 * @returns {{ kin: object|null, loading: boolean }}
 */
export function useKin() {
  const [kin, setKin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    window.KinBot.ready().then(() => {
      if (mounted) {
        setKin(window.KinBot.kin)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  return { kin, loading }
}

// ─── useUser ────────────────────────────────────────────────────────────────

/**
 * Reactive access to the current user info (id, name, locale, timezone, avatarUrl).
 * Waits for KinBot.ready() then returns KinBot.user.
 *
 * @returns {{ user: object|null, loading: boolean }}
 */
export function useUser() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    window.KinBot.ready().then(() => {
      if (mounted) {
        setUser(window.KinBot.user)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  return { user, loading }
}

// ─── useMediaQuery ──────────────────────────────────────────────────────────

/**
 * Reactive CSS media query hook.
 * Returns true when the query matches.
 *
 * @param {string} query — CSS media query string, e.g. '(min-width: 768px)'
 * @returns {boolean}
 *
 * @example
 *   const isDesktop = useMediaQuery('(min-width: 1024px)')
 *   const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    try { return window.matchMedia(query).matches } catch { return false }
  })

  useEffect(() => {
    let mql
    try { mql = window.matchMedia(query) } catch { return }
    const handler = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    // fallback for older browsers
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [query])

  return matches
}

// ─── useDebounce ────────────────────────────────────────────────────────────

/**
 * Debounce a value. The returned value only updates after the specified delay
 * of inactivity.
 *
 * @param {any} value — value to debounce
 * @param {number} delayMs — debounce delay in milliseconds (default: 300)
 * @returns {any} — debounced value
 *
 * @example
 *   const [search, setSearch] = useState('')
 *   const debouncedSearch = useDebounce(search, 500)
 *   useEffect(() => { fetchResults(debouncedSearch) }, [debouncedSearch])
 */
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

// ─── useInterval ────────────────────────────────────────────────────────────

/**
 * Declarative setInterval hook. Pass null as delay to pause.
 *
 * @param {Function} callback — function to call on each interval
 * @param {number|null} delayMs — interval in ms, or null to pause
 *
 * @example
 *   const [count, setCount] = useState(0)
 *   useInterval(() => setCount(c => c + 1), 1000)
 */
export function useInterval(callback, delayMs) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delayMs == null) return
    const id = setInterval(() => savedCallback.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs])
}

// ─── useClickOutside ────────────────────────────────────────────────────────

/**
 * Call a handler when a click happens outside the referenced element.
 * Useful for closing dropdowns, modals, popovers, etc.
 *
 * @param {React.RefObject} ref — ref attached to the element
 * @param {Function} handler — called when click is outside
 *
 * @example
 *   const ref = useRef(null)
 *   useClickOutside(ref, () => setOpen(false))
 *   return <div ref={ref}>...</div>
 */
export function useClickOutside(ref, handler) {
  const savedHandler = useRef(handler)

  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return
      savedHandler.current(e)
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref])
}

// ─── useForm ────────────────────────────────────────────────────────────────

/**
 * Simple form state management hook with validation support.
 *
 * @param {object} initialValues — initial form field values
 * @param {Function} [validate] — optional validation function: (values) => { fieldName: 'error message' }
 * @returns {{ values, errors, touched, setValue, setValues, handleChange, handleBlur, handleSubmit, reset, isValid, isDirty }}
 *
 * @example
 *   const form = useForm({ name: '', email: '' }, (v) => {
 *     const errs = {}
 *     if (!v.name) errs.name = 'Required'
 *     if (!v.email.includes('@')) errs.email = 'Invalid email'
 *     return errs
 *   })
 *
 *   <Input value={form.values.name} onChange={form.handleChange('name')}
 *          onBlur={form.handleBlur('name')} error={form.touched.name && form.errors.name} />
 *   <Button onClick={form.handleSubmit((values) => save(values))} disabled={!form.isValid}>Save</Button>
 */
export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [errors, setErrors] = useState({})
  const initialRef = useRef(initialValues)

  // Run validation whenever values change
  useEffect(() => {
    if (validate) {
      const errs = validate(values) || {}
      setErrors(errs)
    }
  }, [values])

  const setValue = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleChange = useCallback((field) => {
    return (e) => {
      const val = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
      setValues((prev) => ({ ...prev, [field]: val }))
    }
  }, [])

  const handleBlur = useCallback((field) => {
    return () => setTouched((prev) => ({ ...prev, [field]: true }))
  }, [])

  const handleSubmit = useCallback((onSubmit) => {
    return (e) => {
      if (e && e.preventDefault) e.preventDefault()
      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {})
      setTouched(allTouched)

      if (validate) {
        const errs = validate(values) || {}
        setErrors(errs)
        if (Object.keys(errs).length > 0) return
      }
      onSubmit(values)
    }
  }, [values, validate])

  const reset = useCallback(() => {
    setValues(initialRef.current)
    setTouched({})
    setErrors({})
  }, [])

  const isValid = Object.keys(errors).length === 0
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialRef.current)

  return { values, errors, touched, setValue, setValues, handleChange, handleBlur, handleSubmit, reset, isValid, isDirty }
}

// ─── useMemory ──────────────────────────────────────────────────────────────

/**
 * Hook for searching and storing Kin memories from within a mini-app.
 * Wraps KinBot.memory.search() and KinBot.memory.store().
 *
 * @returns {{ search: (query, limit?) => Promise<Array>, store: (content, options?) => Promise<object>, results: Array, loading: boolean }}
 *
 * @example
 *   const memory = useMemory()
 *   const results = await memory.search('user preferences')
 *   await memory.store('User prefers dark mode')
 */
export function useMemory() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query, limit) => {
    setLoading(true)
    try {
      const res = await window.KinBot.memory.search(query, limit)
      setResults(res)
      return res
    } catch (err) {
      console.error('[KinBot React] useMemory search failed:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const store = useCallback(async (content, options) => {
    try {
      return await window.KinBot.memory.store(content, options)
    } catch (err) {
      console.error('[KinBot React] useMemory store failed:', err)
      throw err
    }
  }, [])

  return { search, store, results, loading }
}

// ─── useConversation ────────────────────────────────────────────────────────

/**
 * Hook for interacting with the Kin's conversation.
 * Wraps KinBot.conversation.history() and KinBot.conversation.send().
 *
 * @returns {{ history: (limit?) => Promise<Array>, send: (text, options?) => Promise, messages: Array, loading: boolean }}
 *
 * @example
 *   const conv = useConversation()
 *   useEffect(() => { conv.history(10) }, [])
 *   conv.send('Hello from my mini-app!')
 */
export function useConversation() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const history = useCallback(async (limit) => {
    setLoading(true)
    try {
      const msgs = await window.KinBot.conversation.history(limit)
      setMessages(msgs)
      return msgs
    } catch (err) {
      console.error('[KinBot React] useConversation history failed:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const send = useCallback(async (text, options) => {
    try {
      return await window.KinBot.conversation.send(text, options)
    } catch (err) {
      console.error('[KinBot React] useConversation send failed:', err)
      throw err
    }
  }, [])

  return { history, send, messages, loading }
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
export const kin = window.KinBot.kin
export const user = window.KinBot.user
export const memory = window.KinBot.memory
export const conversation = window.KinBot.conversation
export const notification = window.KinBot.notification
export const resize = window.KinBot.resize
export const share = window.KinBot.share
