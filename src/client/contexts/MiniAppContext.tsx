import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useSSE } from '@/client/hooks/useSSE'

type ActiveTab = 'mini-app' | 'task'

interface TaskPanelInfo {
  taskId: string
  kinName?: string
  kinAvatarUrl?: string | null
}

interface MiniAppContextValue {
  // Panel state
  panelOpen: boolean
  activeTab: ActiveTab | null

  // Mini-app state
  activeAppId: string | null
  activeAppVersion: number
  isFullPage: boolean
  customTitle: string | null
  badges: Record<string, string>

  // Task state
  activeTask: TaskPanelInfo | null

  // Mini-app actions
  openApp: (appId: string) => void
  closePanel: () => void
  toggleFullPage: () => void
  setFullPage: (value: boolean) => void
  setCustomTitle: (title: string | null) => void
  setBadge: (appId: string, value: string | null) => void

  // Task actions
  openTask: (info: TaskPanelInfo) => void
  closeTask: () => void

  // Tab switching
  switchTab: (tab: ActiveTab) => void
}

const MiniAppContext = createContext<MiniAppContextValue | null>(null)

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [activeAppVersion, setActiveAppVersion] = useState(0)
  const [isFullPage, setIsFullPage] = useState(false)
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [badges, setBadgesState] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null)
  const [activeTask, setActiveTask] = useState<TaskPanelInfo | null>(null)

  const openApp = useCallback((appId: string) => {
    setActiveAppId(appId)
    setActiveAppVersion((v) => v + 1)
    setCustomTitle(null)
    setActiveTab('mini-app')
  }, [])

  const openTask = useCallback((info: TaskPanelInfo) => {
    setActiveTask(info)
    setActiveTab('task')
    // Exit full page mode if switching to task
    setIsFullPage(false)
  }, [])

  const closeTask = useCallback(() => {
    setActiveTask(null)
    // If there's a mini-app loaded, switch to it; otherwise close panel
    if (activeAppId) {
      setActiveTab('mini-app')
    } else {
      setActiveTab(null)
    }
  }, [activeAppId])

  const closePanel = useCallback(() => {
    // Close whichever tab is active
    if (activeTab === 'mini-app') {
      setActiveAppId(null)
      setIsFullPage(false)
      setCustomTitle(null)
      if (activeTask) {
        setActiveTab('task')
      } else {
        setActiveTab(null)
      }
    } else if (activeTab === 'task') {
      setActiveTask(null)
      if (activeAppId) {
        setActiveTab('mini-app')
      } else {
        setActiveTab(null)
      }
    } else {
      // Close everything
      setActiveAppId(null)
      setActiveTask(null)
      setIsFullPage(false)
      setCustomTitle(null)
      setActiveTab(null)
    }
  }, [activeTab, activeTask, activeAppId])

  const toggleFullPage = useCallback(() => {
    setIsFullPage((v) => !v)
  }, [])

  const setFullPage = useCallback((value: boolean) => {
    setIsFullPage(value)
  }, [])

  const switchTab = useCallback((tab: ActiveTab) => {
    if (tab === 'mini-app' && activeAppId) {
      setActiveTab('mini-app')
    } else if (tab === 'task' && activeTask) {
      setActiveTab('task')
    }
  }, [activeAppId, activeTask])

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
        setCustomTitle(null)
        setIsFullPage(false)
        if (activeTask) {
          setActiveTab('task')
        } else {
          setActiveTab(null)
        }
      }
      // Clean up badge for deleted app
      setBadge(appId, null)
    },
  })

  const panelOpen = activeTab !== null && (
    (activeTab === 'mini-app' && activeAppId !== null) ||
    (activeTab === 'task' && activeTask !== null)
  )

  return (
    <MiniAppContext.Provider
      value={{
        panelOpen,
        activeTab,
        activeAppId,
        activeAppVersion,
        isFullPage,
        customTitle,
        badges,
        activeTask,
        openApp,
        closePanel,
        toggleFullPage,
        setFullPage,
        setCustomTitle,
        setBadge,
        openTask,
        closeTask,
        switchTab,
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
