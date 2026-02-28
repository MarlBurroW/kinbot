import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useSSE } from '@/client/hooks/useSSE'

interface MiniAppContextValue {
  panelOpen: boolean
  activeAppId: string | null
  activeAppVersion: number
  isFullPage: boolean
  openApp: (appId: string) => void
  closePanel: () => void
  toggleFullPage: () => void
  setFullPage: (value: boolean) => void
}

const MiniAppContext = createContext<MiniAppContextValue | null>(null)

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [activeAppVersion, setActiveAppVersion] = useState(0)
  const [isFullPage, setIsFullPage] = useState(false)

  const openApp = useCallback((appId: string) => {
    setActiveAppId(appId)
    setActiveAppVersion((v) => v + 1)
  }, [])

  const closePanel = useCallback(() => {
    setActiveAppId(null)
    setIsFullPage(false)
  }, [])

  const toggleFullPage = useCallback(() => {
    setIsFullPage((v) => !v)
  }, [])

  const setFullPage = useCallback((value: boolean) => {
    setIsFullPage(value)
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
        openApp,
        closePanel,
        toggleFullPage,
        setFullPage,
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
