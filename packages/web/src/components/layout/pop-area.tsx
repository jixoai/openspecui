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
  useRef,
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
    topGap: 'none' | 'compact' | 'comfortable'
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
    topGap: 'comfortable',
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

interface PopAreaLifecycleContextValue {
  requestClose: () => void
  closeRequestVersion: number
}

const PopAreaConfigContext = createContext<PopAreaConfigContextValue | null>(null)
const PopAreaLifecycleContext = createContext<PopAreaLifecycleContextValue | null>(null)

function PopAreaConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<PopAreaConfig>(DEFAULT_POP_AREA_CONFIG)
  const [closeRequestVersion, setCloseRequestVersion] = useState(0)

  const setConfig = useCallback((patch: Partial<PopAreaConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_POP_AREA_CONFIG)
  }, [])

  const requestClose = useCallback(() => {
    setCloseRequestVersion((value) => value + 1)
  }, [])

  const value = useMemo(
    () => ({
      config,
      setConfig,
      resetConfig,
    }),
    [config, resetConfig, setConfig]
  )
  const lifecycleValue = useMemo(
    () => ({
      requestClose,
      closeRequestVersion,
    }),
    [closeRequestVersion, requestClose]
  )

  return (
    <PopAreaConfigContext.Provider value={value}>
      <PopAreaLifecycleContext.Provider value={lifecycleValue}>
        {children}
      </PopAreaLifecycleContext.Provider>
    </PopAreaConfigContext.Provider>
  )
}

export function usePopAreaConfigContext(): PopAreaConfigContextValue {
  const ctx = useContext(PopAreaConfigContext)
  if (!ctx) {
    throw new Error('usePopAreaConfigContext must be used within PopAreaConfigProvider')
  }
  return ctx
}

export function usePopAreaLifecycleContext(): PopAreaLifecycleContextValue {
  const ctx = useContext(PopAreaLifecycleContext)
  if (!ctx) {
    throw new Error('usePopAreaLifecycleContext must be used within PopAreaConfigProvider')
  }
  return ctx
}

let _popRouter: AnyRouter | null = null

export function setPopRouter(router: AnyRouter | null): void {
  _popRouter = router
}

function getTitle(pathname: string): string {
  if (pathname === '/search') return 'Search'
  if (pathname === '/opsx-new') return 'OPSX New'
  if (pathname === '/opsx-compose') return 'OPSX Compose'
  return 'Panel'
}

function PopAreaDialog() {
  const navLayout = useNavLayout()
  const { config, resetConfig } = usePopAreaConfigContext()
  const { requestClose, closeRequestVersion } = usePopAreaLifecycleContext()
  const [dialogOpen, setDialogOpen] = useState(navLayout.popActive)
  const [deactivateAfterClose, setDeactivateAfterClose] = useState(false)
  const handledCloseRequestVersionRef = useRef(0)

  const semanticDialogClassName = useMemo(() => {
    return config.dialogClassName
  }, [config.dialogClassName])

  const semanticContentClassName = useMemo(() => {
    const alignClass =
      config.layout.alignY === 'start'
        ? 'items-start'
        : config.layout.alignY === 'end'
          ? 'items-end'
          : 'items-center'
    const topGapClass =
      config.layout.alignY !== 'start'
        ? ''
        : config.layout.topGap === 'none'
          ? 'pt-[env(safe-area-inset-top)]'
          : config.layout.topGap === 'compact'
            ? 'pt-[max(0.5rem,env(safe-area-inset-top))] sm:pt-3'
            : 'pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-5'
    const endGapClass =
      config.layout.alignY === 'end' ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : ''

    return [alignClass, topGapClass, endGapClass].filter((v) => v.length > 0).join(' ')
  }, [config.layout.alignY, config.layout.topGap])

  const semanticPanelClassName = useMemo(() => {
    if (config.layout.width === 'narrow') return 'max-w-2xl'
    if (config.layout.width === 'normal') return 'max-w-3xl'
    if (config.layout.width === 'full') return 'max-w-[min(96vw,1280px)]'
    return 'max-w-4xl'
  }, [config.layout.width])

  useEffect(() => {
    if (navLayout.popActive) {
      if (!deactivateAfterClose) {
        setDialogOpen(true)
      }
      return
    }

    setDialogOpen(false)
  }, [deactivateAfterClose, navLayout.popActive])

  useEffect(() => {
    if (closeRequestVersion <= handledCloseRequestVersionRef.current) return
    handledCloseRequestVersionRef.current = closeRequestVersion
    if (!navLayout.popActive) return

    setDeactivateAfterClose(true)
    setDialogOpen(false)
  }, [closeRequestVersion, navLayout.popActive])

  const handleClosed = useCallback(() => {
    if (deactivateAfterClose) {
      navController.deactivatePop()
      setDeactivateAfterClose(false)
    }
    resetConfig()
  }, [deactivateAfterClose, resetConfig])

  if (!_popRouter) return null

  return (
    <Dialog
      open={dialogOpen}
      onClose={requestClose}
      onClosed={handleClosed}
      title={
        <span className="font-nav tracking-[0.04em]">
          {getTitle(navLayout.popLocation.pathname)}
        </span>
      }
      dialogClassName={semanticDialogClassName}
      contentClassName={semanticContentClassName}
      className={[semanticPanelClassName, config.panelClassName]
        .filter((v) => v.length > 0)
        .join(' ')}
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
