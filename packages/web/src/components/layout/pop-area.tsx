import { Dialog } from '@/components/dialog'
import { navController } from '@/lib/nav-controller'
import { useNavLayout } from '@/lib/use-nav-controller'
import { Outlet, RouterProvider, type AnyRouter } from '@tanstack/react-router'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export function PopArea() {
  return <Outlet />
}

export interface PopAreaConfig {
  layout: {
    alignY: 'start' | 'center' | 'end'
    width: 'narrow' | 'normal' | 'wide' | 'full'
  }
  dialogClassName: string
  panelClassName: string
  bodyClassName: string
  maxHeight: string
}

const DEFAULT_POP_AREA_CONFIG: PopAreaConfig = {
  layout: {
    alignY: 'center',
    width: 'wide',
  },
  dialogClassName: '',
  panelClassName: '',
  bodyClassName: 'p-0',
  maxHeight: '90vh',
}

interface PopAreaConfigContextValue {
  config: PopAreaConfig
  setConfig: (patch: Partial<PopAreaConfig>) => void
  resetConfig: () => void
}

const PopAreaConfigContext = createContext<PopAreaConfigContextValue | null>(null)

function PopAreaConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<PopAreaConfig>(DEFAULT_POP_AREA_CONFIG)

  const setConfig = useCallback((patch: Partial<PopAreaConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_POP_AREA_CONFIG)
  }, [])

  const value = useMemo(
    () => ({
      config,
      setConfig,
      resetConfig,
    }),
    [config, resetConfig, setConfig]
  )

  return <PopAreaConfigContext.Provider value={value}>{children}</PopAreaConfigContext.Provider>
}

export function usePopAreaConfigContext(): PopAreaConfigContextValue {
  const ctx = useContext(PopAreaConfigContext)
  if (!ctx) {
    throw new Error('usePopAreaConfigContext must be used within PopAreaConfigProvider')
  }
  return ctx
}

let _popRouter: AnyRouter | null = null

export function setPopRouter(router: AnyRouter | null): void {
  _popRouter = router
}

function getTitle(pathname: string): string {
  if (pathname === '/search') return 'Search'
  return 'Panel'
}

function PopAreaDialog() {
  const navLayout = useNavLayout()
  const { config, resetConfig } = usePopAreaConfigContext()

  const semanticDialogClassName = useMemo(() => {
    if (config.layout.alignY === 'start') {
      return 'mt-[max(1rem,env(safe-area-inset-top))] mb-auto'
    }
    if (config.layout.alignY === 'end') {
      return 'mt-auto mb-[max(1rem,env(safe-area-inset-bottom))]'
    }
    return ''
  }, [config.layout.alignY])

  const semanticPanelClassName = useMemo(() => {
    if (config.layout.width === 'narrow') return 'max-w-2xl'
    if (config.layout.width === 'normal') return 'max-w-3xl'
    if (config.layout.width === 'full') return 'max-w-[min(96vw,1280px)]'
    return 'max-w-4xl'
  }, [config.layout.width])

  useEffect(() => {
    if (navLayout.popActive) return
    resetConfig()
  }, [navLayout.popActive, resetConfig])

  if (!_popRouter) return null

  return (
    <Dialog
      open={navLayout.popActive}
      onClose={() => navController.deactivatePop()}
      title={
        <span className="font-nav tracking-[0.04em]">
          {getTitle(navLayout.popLocation.pathname)}
        </span>
      }
      dialogClassName={[semanticDialogClassName, config.dialogClassName]
        .filter((v) => v.length > 0)
        .join(' ')}
      className={[semanticPanelClassName, config.panelClassName].filter((v) => v.length > 0).join(' ')}
      bodyClassName={config.bodyClassName}
      maxHeight={config.maxHeight}
    >
      <RouterProvider router={_popRouter} />
    </Dialog>
  )
}

export function PopAreaRouter() {
  if (!_popRouter) return null

  return (
    <PopAreaConfigProvider>
      <PopAreaDialog />
    </PopAreaConfigProvider>
  )
}
