import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useSSE } from '@/client/hooks/useSSE'

interface MiniAppContextValue {
  panelOpen: boolean
  activeAppId: string | null
  activeAppVersion: number
  isFullPage: boolean
  customTitle: string | null
  badges: Record<string, string>
  openApp: (appId: string) => void
  closePanel: () => void
  toggleFullPage: () => void
  setFullPage: (value: boolean) => void
  setCustomTitle: (title: string | null) => void
  setBadge: (appId: string, value: string | null) => void
}

const MiniAppContext = createContext<MiniAppContextValue | null>(null)

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [activeAppVersion, setActiveAppVersion] = useState(0)
  const [isFullPage, setIsFullPage] = useState(false)
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [badges, setBadgesState] = useState<Record<string, string>>({})

  const openApp = useCallback((appId: string) => {
    setActiveAppId(appId)
    setActiveAppVersion((v) => v + 1)
    setCustomTitle(null) // Reset custom title when switching apps
  }, [])

  const closePanel = useCallback(() => {
    setActiveAppId(null)
    setIsFullPage(false)
    setCustomTitle(null)
  }, [])

  const toggleFullPage = useCallback(() => {
    setIsFullPage((v) => !v)
  }, [])

  const setFullPage = useCallback((value: boolean) => {
    setIsFullPage(value)
  }, [])

  const setBadge = useCallback((appId: string, value: string | null) => {
    setBadgesState((prev) => {
      if (value === null) {
        const next = { ...prev }
        delete next[appId]
        return next
      }
      return { ...prev, [appId]: value }
    })
  }, [])

  // Listen for file updates to reload the active app's iframe
  useSSE({
    'miniapp:file-updated': (data) => {
      const appId = data.appId as string
      const version = data.version as number
      if (appId === activeAppId) {
        setActiveAppVersion(version)
      }
    },
    'miniapp:deleted': (data) => {
      const appId = data.appId as string
      if (appId === activeAppId) {
        setActiveAppId(null)
      }
    },
  })

  return (
    <MiniAppContext.Provider
      value={{
        panelOpen: activeAppId !== null,
        activeAppId,
        activeAppVersion,
        isFullPage,
        customTitle,
        badges,
        openApp,
        closePanel,
        toggleFullPage,
        setFullPage,
        setCustomTitle,
        setBadge,
      }}
    >
      {children}
    </MiniAppContext.Provider>
  )
}

export function useMiniAppPanel() {
  const ctx = useContext(MiniAppContext)
  if (!ctx) {
    throw new Error('useMiniAppPanel must be used within a MiniAppProvider')
  }
  return ctx
}
